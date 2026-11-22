"""Build the V1 dashboard from the formal plan and current GitHub data."""

import argparse
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
PLAN = HERE.parent / "Travel-Atlas-Book-V1-Development-Plan.md"
TASKS = HERE / "task-plan.json"
REPO = "xiaoguijj/travel-atlas-book"
BASE = "main"
STATES = {
    "done": "已完成",
    "review": "审核中",
    "development": "开发中",
    "claimed": "已认领",
    "ready": "可认领",
    "blocked": "未就绪",
}


def read_formal_plan(text):
    """Copy the branch table (§4) and task cards (§5), preserving their text."""
    table = text.split("## 4. ", 1)[1].split("## 5. ", 1)[0]
    cards = text.split("## 5. ", 1)[1].split("## 6. ", 1)[0]
    tasks = {}
    for line in table.splitlines():
        match = re.match(r"^\| (V1-\d{2}) · `([^`]+)` \| (.+) \| (.+) \| (.+) \| .+ \|$", line)
        if match:
            task, branch, deliverable, dependencies, parallel = match.groups()
            tasks[task] = {
                "id": task, "branch": branch, "deliverable": deliverable,
                "dependencies": [f"V1-{part}" for part in re.findall(r"\d{2}", dependencies)],
                "parallel": parallel,
            }

    sections = re.split(r"^### (V1-\d{2}) · `([^`]+)` · (.+)$", cards, flags=re.M)
    seen = set()
    for start in range(1, len(sections), 4):
        task, branch, title, body = sections[start:start + 4]
        entry = tasks[task]
        if entry["branch"] != branch or task in seen:
            raise ValueError(f"Conflicting task card for {task}")
        seen.add(task)
        entry["title"] = title
        if task == "V1-03":
            design, handoff = re.findall(r"^- (.+)$", body, flags=re.M)
            entry.update(description=design, scope=handoff, boundary=handoff, acceptance=design)
            continue
        bullets = dict(re.findall(r"^- \*\*(.+?)\*\*\s+([^\n]+)$", body, flags=re.M))
        entry.update(
            description=bullets["目标"], scope=bullets["工作"], boundary=bullets["边界与文件"],
            kickoff=bullets["前置 / 并行 / 难度"], acceptance=bullets["验收"],
            mergeCriteria=bullets["合并条件"],
        )
    if not tasks or seen != tasks.keys():
        raise ValueError("The branch table and task cards disagree")
    return list(tasks.values())


def dependency_layers(tasks):
    by_id = {task["id"]: task["dependencies"] for task in tasks}
    if len(by_id) != len(tasks) or len({task["branch"] for task in tasks}) != len(tasks):
        raise ValueError("Task IDs and recommended branches must be unique")
    for task, dependencies in by_id.items():
        if len(set(dependencies)) != len(dependencies) or set(dependencies) - by_id.keys():
            raise ValueError(f"Invalid dependencies for {task}: {dependencies}")
    layers = {}
    while len(layers) < len(by_id):
        layer = {
            task: max((layers[dep] + 1 for dep in dependencies), default=0)
            for task, dependencies in by_id.items()
            if task not in layers and all(dep in layers for dep in dependencies)
        }
        if not layer:
            raise ValueError("Cycle in the task plan")
        layers.update(layer)
    return layers


def github(path, paginated=False):
    command = ["gh", "api", path]
    if paginated:
        command += ["--paginate", "--slurp"]
    result = subprocess.run(command, check=True, capture_output=True, encoding="utf-8", timeout=90)
    data = json.loads(result.stdout)
    return [item for page in data for item in page] if paginated else data


def review_feedback(reviews):
    # A later approval clears this reviewer's request. A comment alone leaves it in place.
    latest = {}
    for review in reviews:  # GitHub returns reviews in chronological order.
        if review["user"] and review["state"] in {"CHANGES_REQUESTED", "APPROVED", "DISMISSED"}:
            latest[review["user"]["login"]] = review
    return [
        {"reviewer": reviewer, "url": review["html_url"], "body": (review["body"] or "").strip()[:280]}
        for reviewer, review in latest.items()
        if review["state"] == "CHANGES_REQUESTED"
    ]


def task_branches(tasks, aliases):
    branches = {task["branch"]: task["id"] for task in tasks}
    if branches.keys() & aliases.keys() or BASE in aliases or set(aliases.values()) - set(branches.values()):
        raise ValueError("Invalid task branch alias")
    return branches | aliases


def pr_state(pr):
    if pr["merged_at"]:
        return "merged"
    if pr["state"] == "closed":
        return "closed"
    return "draft" if pr["draft"] else "open"


def resolve_tasks(tasks, aliases, branches, pulls, repo=REPO):
    layers = dependency_layers(tasks)
    tracked = task_branches(tasks, aliases)
    matched = {task["id"]: [] for task in tasks}
    for pr in sorted(pulls, key=lambda pr: pr["number"], reverse=True):
        head = pr["head"]
        if (
            pr["base"]["ref"] == BASE
            and (head["repo"] or {}).get("full_name", "").lower() == repo.lower()
            and head["ref"] in tracked
        ):
            matched[tracked[head["ref"]]].append(pr)

    completed = {
        task for task, prs in matched.items() if any(pr_state(pr) == "merged" for pr in prs)
    }
    resolved = []
    for task in tasks:
        task_id = task["id"]
        open_branches = [
            {"name": name, "ahead": branches[name]}
            for name, owner in tracked.items()
            if owner == task_id and name in branches
        ]
        prs = matched[task_id]
        missing = [dep for dep in task["dependencies"] if dep not in completed]
        if task_id in completed:
            state = "done"
        elif any(pr_state(pr) == "open" for pr in prs):
            state = "review"
        elif any(pr_state(pr) == "draft" for pr in prs) or any(ref["ahead"] for ref in open_branches):
            state = "development"
        elif open_branches:
            state = "claimed"
        else:
            state = "blocked" if missing else "ready"
        resolved.append({
            **task, "layer": layers[task_id], "state": state,
            "missing": missing, "branches": open_branches, "pulls": prs,
        })
    return resolved


def snapshot(tasks, legacy, repo=REPO, query=github):
    path = f"repos/{repo}"
    refs = {ref["name"]: ref["commit"]["sha"] for ref in query(f"{path}/branches?per_page=100", True)}
    base_sha = refs[BASE]
    pulls = query(f"{path}/pulls?state=all&base={BASE}&per_page=100", True)
    tracked = task_branches(tasks, legacy["aliases"])
    ahead = {}
    for name in tracked.keys() & refs.keys():
        sha = refs[name]
        ahead[name] = 0 if sha == base_sha else query(f"{path}/compare/{base_sha}...{sha}?per_page=1")["ahead_by"]
    resolved = resolve_tasks(tasks, legacy["aliases"], ahead, pulls, repo)
    for task in resolved:
        task["pulls"] = [
            {
                "number": pr["number"], "url": pr["html_url"], "branch": pr["head"]["ref"],
                "state": pr_state(pr),
                "feedback": review_feedback(query(f'{path}/pulls/{pr["number"]}/reviews?per_page=100', True))
                if pr_state(pr) == "open" else [],
            }
            for pr in task["pulls"]
        ]
    pulls_by_number = {pr["number"]: pr for pr in pulls}
    related = []
    for record in legacy["related"]:
        if set(record["tasks"]) - {task["id"] for task in tasks}:
            raise ValueError(f"Unknown task in legacy record: {record}")
        entry = dict(record)
        if "branch" in record and record["branch"] in refs:
            entry["url"] = f"https://github.com/{repo}/tree/{quote(record['branch'])}"
        if "pr" in record and record["pr"] in pulls_by_number:
            pr = pulls_by_number[record["pr"]]
            entry.update(url=pr["html_url"], branch=pr["head"]["ref"])
        related.append(entry)
    return {
        "repository": f"https://github.com/{repo}", "base": BASE, "baseSha": base_sha,
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "counts": {state: sum(task["state"] == state for task in resolved) for state in STATES},
        "labels": STATES, "tasks": resolved, "related": related,
    }


def render_badge(data):
    counts = data["counts"]
    label = f'V1 进度 · {counts["done"]}/{len(data["tasks"])} 完成 · 开发 {counts["development"]} · 审核 {counts["review"]} · 可领 {counts["ready"]}'
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="378" height="28" role="img">'
        f'<title>{escape(label)}</title><rect width="378" height="28" rx="4" fill="#213549"/>'
        f'<text x="189" y="19" fill="#fff3d5" text-anchor="middle" '
        f'font-family="system-ui, sans-serif" font-size="13">{escape(label)}</text></svg>\n'
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="directory for the static Pages artifact")
    parser.add_argument("--sync-plan", action="store_true", help="regenerate task-plan.json from the formal plan")
    args = parser.parse_args()
    tasks = read_formal_plan(PLAN.read_text(encoding="utf-8"))
    dependency_layers(tasks)
    if args.sync_plan:
        TASKS.write_text(json.dumps(tasks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return
    if not args.output:
        parser.error("specify --output or --sync-plan")
    if json.loads(TASKS.read_text(encoding="utf-8")) != tasks:
        raise ValueError("task-plan.json is out of sync. Run progress.py --sync-plan.")
    legacy = json.loads((HERE / "legacy-links.json").read_text(encoding="utf-8"))
    try:
        data = snapshot(tasks, legacy)
    except (subprocess.SubprocessError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise SystemExit(f"GitHub snapshot failed; no new site was built. {getattr(error, 'stderr', None) or error}")
    dashboard = args.output / "v1"
    shutil.copytree(HERE / "dashboard", dashboard, dirs_exist_ok=True)
    index = dashboard / "index.html"
    # Embed the snapshot so that the Actions artifact also opens directly from disk.
    sealed_json = json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")
    index.write_text(index.read_text(encoding="utf-8").replace("<!-- SNAPSHOT -->", sealed_json), encoding="utf-8")
    (dashboard / "progress.svg").write_text(render_badge(data), encoding="utf-8")
    (args.output / "index.html").write_text(
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>V1 开发看板</title>'
        '<meta http-equiv="refresh" content="0; url=./v1/"><a href="./v1/">V1 开发看板</a></html>\n',
        encoding="utf-8",
    )
    print(" | ".join(f'{task["id"]} {STATES[task["state"]]}' for task in data["tasks"]))


if __name__ == "__main__":
    main()
