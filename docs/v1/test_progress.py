import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import progress


REPO = progress.REPO
BRANCH_A = "v1/01-globe-baseline"
BRANCH_B = "v1/02-example"
ALIAS = "legacy-a"
TASKS = [
    {"id": "B", "branch": BRANCH_B, "dependencies": ["A"]},
    {"id": "A", "branch": BRANCH_A, "dependencies": []},
]


def pull(number=1, *, head=BRANCH_A, state="open", draft=False, merged=None, repo=REPO, base="main"):
    return {
        "number": number, "state": state, "draft": draft, "merged_at": merged,
        "head": {"ref": head, "repo": {"full_name": repo} if repo else None},
        "base": {"ref": base}, "html_url": f"https://github.com/{REPO}/pull/{number}",
    }


class TaskStatusTests(unittest.TestCase):
    def resolve(self, branches=None, pulls=()):
        return {
            task["id"]: task
            for task in progress.resolve_tasks(TASKS, {ALIAS: "A"}, branches or {}, pulls)
        }

    def test_unstarted_tasks_respect_dependencies_even_when_plan_order_is_reversed(self):
        tasks = self.resolve()
        self.assertEqual(tasks["A"]["state"], "ready")
        self.assertEqual(tasks["B"]["state"], "blocked")
        self.assertEqual(tasks["B"]["missing"], ["A"])

    def test_legacy_alias_can_claim_a_task_without_commits(self):
        tasks = self.resolve({ALIAS: 0})
        self.assertEqual(tasks["A"]["state"], "claimed")
        self.assertEqual(tasks["A"]["branches"], [{"name": ALIAS, "ahead": 0}])

    def test_unique_head_commits_mean_development_even_before_dependencies_merge(self):
        tasks = self.resolve({BRANCH_B: 3})
        self.assertEqual(tasks["B"]["state"], "development")
        self.assertEqual(tasks["B"]["missing"], ["A"])

    def test_draft_and_ready_transition(self):
        for draft, expected in [(True, "development"), (False, "review"), (True, "development")]:
            with self.subTest(draft=draft, expected=expected):
                self.assertEqual(self.resolve({BRANCH_A: 0}, [pull(draft=draft)])["A"]["state"], expected)

    def test_closed_unmerged_and_reopen(self):
        for pr, expected in [(pull(state="closed"), "development"), (pull(), "review")]:
            self.assertEqual(self.resolve({BRANCH_A: 2}, [pr])["A"]["state"], expected)
        self.assertEqual(self.resolve(pulls=[pull(state="closed")])["A"]["state"], "ready")

    def test_merged_alias_after_branch_deletion_takes_priority_and_unblocks_dependants(self):
        merged = pull(head=ALIAS, state="closed", merged="2026-11-22T04:00:00Z")
        tasks = self.resolve(pulls=[merged, pull(2), pull(3, draft=True)])
        self.assertEqual(tasks["A"]["state"], "done")
        self.assertEqual(tasks["A"]["branches"], [])
        self.assertEqual(tasks["A"]["pulls"][-1]["number"], 1)
        self.assertEqual(tasks["B"]["state"], "ready")

    def test_unregistered_names_forks_and_other_bases_never_complete_tasks(self):
        ignored = [
            pull(1, repo="someone/travel-atlas-book"),
            pull(2, head="codex/partial-work", state="closed", merged="2026-11-22T04:00:00Z"),
            pull(3, base="integration", state="closed", merged="2026-11-22T04:00:00Z"),
            pull(4, repo=None),
        ]
        tasks = self.resolve({"codex/partial-work": 3}, ignored)
        self.assertEqual(tasks["A"]["state"], "ready")
        self.assertEqual(tasks["A"]["pulls"], [])


class SnapshotTests(unittest.TestCase):
    def test_diverged_branch_compares_pinned_commits_and_uses_ahead_count(self):
        path = f"repos/{REPO}"
        responses = {
            f"{path}/branches?per_page=100": [
                {"name": "main", "commit": {"sha": "base-sha"}},
                {"name": BRANCH_A, "commit": {"sha": "branch-sha"}},
            ],
            f"{path}/pulls?state=all&base=main&per_page=100": [],
            f"{path}/compare/base-sha...branch-sha?per_page=1": {
                "status": "diverged", "ahead_by": 4, "behind_by": 6,
            },
        }
        data = progress.snapshot(
            TASKS, {"aliases": {}, "related": []}, query=lambda url, *_: responses[url],
        )
        self.assertEqual(data["tasks"][1]["state"], "development")
        self.assertEqual(data["tasks"][1]["branches"][0]["ahead"], 4)

    def test_reviews_show_latest_decisions_without_changing_review_status(self):
        def review(login, state):
            return {
                "user": {"login": login}, "state": state, "body": "检查演示路径",
                "html_url": f"https://github.com/{REPO}/pull/1#pullrequestreview-{login}",
            }

        def query(url, *_):
            if "/branches" in url:
                return [{"name": "main", "commit": {"sha": "base-sha"}}]
            if "/reviews" in url:
                return [
                    review("alice", "CHANGES_REQUESTED"),
                    review("bob", "CHANGES_REQUESTED"),
                    review("carol", "CHANGES_REQUESTED"),
                    review("alice", "APPROVED"),
                    review("bob", "COMMENTED"),
                    review("carol", "DISMISSED"),
                ]
            return [pull()]

        data = progress.snapshot(TASKS, {"aliases": {}, "related": []}, query=query)
        task = data["tasks"][1]
        self.assertEqual(task["state"], "review")
        self.assertEqual([item["reviewer"] for item in task["pulls"][0]["feedback"]], ["bob"])
        self.assertEqual(task["pulls"][0]["feedback"][0]["body"], "检查演示路径")

    def test_failed_github_fetch_leaves_previous_output_intact(self):
        with tempfile.TemporaryDirectory() as temp:
            index = Path(temp) / "v1" / "index.html"
            index.parent.mkdir()
            index.write_text("previous successful build", encoding="utf-8")
            with (
                patch("sys.argv", ["progress.py", "--output", temp]),
                patch("progress.snapshot", side_effect=subprocess.CalledProcessError(1, "gh")),
                self.assertRaisesRegex(SystemExit, "no new site was built"),
            ):
                progress.main()
            self.assertEqual(index.read_text(encoding="utf-8"), "previous successful build")


class PlanTests(unittest.TestCase):
    def test_all_plan_cards_and_direct_dependencies_stay_in_sync(self):
        tasks = progress.read_formal_plan(progress.PLAN.read_text(encoding="utf-8"))
        self.assertEqual(json.loads(progress.TASKS.read_text(encoding="utf-8")), tasks)
        ids = [f"V1-{i:02}" for i in range(1, 12)]
        ids.insert(ids.index("V1-08"), "V1-08A")
        self.assertEqual([task["id"] for task in tasks], ids)
        self.assertEqual(sum(len(task["dependencies"]) for task in tasks), 15)
        layers = progress.dependency_layers(tasks)
        for task in tasks:
            self.assertTrue(task["acceptance"])
            for upstream in task["dependencies"]:
                self.assertLess(layers[upstream], layers[task["id"]])

    def test_collage_core_merge_completes_only_the_stage(self):
        tasks = progress.read_formal_plan(progress.PLAN.read_text(encoding="utf-8"))
        merged = "2026-11-26T04:00:00Z"
        pulls = [
            pull(1, head="v1/05-book-shell", state="closed", merged=merged),
            pull(2, head="v1/08a-collage-core", state="closed", merged=merged),
        ]
        states = {task["id"]: task for task in progress.resolve_tasks(tasks, {}, {}, pulls)}
        self.assertEqual(states["V1-08A"]["state"], "done")
        self.assertEqual(states["V1-08"]["state"], "ready")
        self.assertIn("V1-08", states["V1-10"]["missing"])
        self.assertNotIn("V1-08A", states["V1-10"]["dependencies"])

    def test_invalid_dependency_graphs_fail_the_build(self):
        for tasks, error in [
            (TASKS[:1], "Invalid dependencies"),
            ([{**TASKS[0]}, {**TASKS[1], "dependencies": ["B"]}], "Cycle"),
        ]:
            with self.subTest(error=error), self.assertRaisesRegex(ValueError, error):
                progress.dependency_layers(tasks)
