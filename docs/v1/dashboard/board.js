"use strict";

const get = (id) => document.getElementById(id);
const el = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
};

function link(text, url) {
  const a = el("a", text);
  a.href = url;
  return a;
}

function planText(text) {
  const paragraph = el("p");
  // The formal task cards use inline code for paths and identifiers.
  text.split("`").forEach((part, index) => {
    paragraph.append(index % 2 ? el("code", part) : document.createTextNode(part));
  });
  return paragraph;
}

function badge(state, labels) {
  const label = el("span", labels[state], "badge");
  label.dataset.state = state;
  return label;
}

function showConnections(tasks, nodes) {
  const canvas = get("connections");
  const graph = get("graph");
  const repaint = () => {
    if (!canvas.getClientRects().length) return;
    const area = graph.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(area.width * scale);
    canvas.height = Math.ceil(area.height * scale);
    canvas.style.width = `${area.width}px`;
    canvas.style.height = `${area.height}px`;
    const pen = canvas.getContext("2d");
    pen.scale(scale, scale);
    pen.strokeStyle = pen.fillStyle = "#86714f";
    pen.lineWidth = 1.25;
    for (const task of tasks) {
      const end = nodes.get(task.id).getBoundingClientRect();
      const y2 = end.top - area.top - 2;
      task.dependencies.forEach((dependency, index) => {
        const start = nodes.get(dependency).getBoundingClientRect();
        const x1 = start.left + start.width / 2 - area.left;
        const x2 = end.left + end.width * (index + 1) / (task.dependencies.length + 1) - area.left;
        const y1 = start.bottom - area.top - 1;
        const bend = (y2 - y1) * 0.4;
        pen.beginPath();
        pen.moveTo(x1, y1);
        pen.bezierCurveTo(x1, y1 + bend, x2, y2 - bend, x2, y2 - 5);
        pen.stroke();
        pen.beginPath();
        pen.moveTo(x2 - 3.5, y2 - 6);
        pen.lineTo(x2 + 3.5, y2 - 6);
        pen.lineTo(x2, y2);
        pen.fill();
      });
    }
  };
  const observer = new ResizeObserver(repaint);
  observer.observe(graph);
}

function render(data) {
  const { repository, counts, tasks, labels, related, base, baseSha } = data;
  const docs = `${repository}/blob/${base}/docs/`;
  get("repo").href = repository;
  get("plan").href = `${docs}Travel-Atlas-Book-V1-Development-Plan.md`;
  get("guide").href = `${docs}v1/collaboration.md`;
  const timestamp = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(data.updatedAt));
  get("snapshot").append(
    `更新于 ${timestamp}（UTC+8） · `,
    link(`${base}@${baseSha.slice(0, 7)}`, `${repository}/commit/${baseSha}`),
  );

  const percent = Math.round(100 * counts.done / tasks.length);
  get("overall").textContent = `整体进度 ${percent}%`;
  get("progress").max = tasks.length;
  get("progress").value = counts.done;
  for (const [state, name, count] of [
    ["total", "任务总数", tasks.length],
    ...Object.entries(labels).map(([state, name]) => [state, name, counts[state]]),
  ]) {
    const metric = el("div", null, "metric");
    metric.dataset.state = state;
    metric.append(el("dt", name), el("dd", String(count)));
    get("totals").append(metric);
  }

  const ready = tasks.filter((task) => task.state === "ready");
  get("claim-list").textContent = ready.length
    ? `当前可认领　${ready.map((task) => task.id).join(" · ")}`
    : "暂无可认领任务";

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const detail = get("task-detail");
  const content = get("detail-content");
  const prLabels = { merged: "已合并", open: "审核中", draft: "草稿", closed: "已关闭" };
  const branchLink = (name) => link(name, `${repository}/tree/${name.split("/").map(encodeURIComponent).join("/")}`);
  const section = (title, ...children) => {
    const block = el("section");
    block.append(el("h3", title), ...children);
    content.append(block);
  };
  const relatedLabel = (record) => record.pr ? `#${record.pr} · ${record.branch || "历史 PR"}` : record.branch;
  const relatedLink = (record) => record.url ? link(relatedLabel(record), record.url) : el("span", relatedLabel(record));

  function openTask(task) {
    get("task-heading").textContent = `${task.id} · ${task.title}`;
    content.replaceChildren(badge(task.state, labels));
    const sharedAcceptance = task.acceptance === task.description;
    section(sharedAcceptance ? "目标与验收" : "任务目标", planText(task.description));
    if (task.scope !== task.boundary) section("工作范围", planText(task.scope));
    section("任务边界", planText(task.boundary));

    const dependencies = el("ul");
    for (const id of task.dependencies) {
      const upstream = byId.get(id);
      const button = el("button", `${id} · ${upstream.title}`, "dependency-link");
      button.type = "button";
      button.addEventListener("click", () => openTask(upstream));
      const row = el("li");
      row.append(button, `（${labels[upstream.state]}）`);
      dependencies.append(row);
    }
    section("合并前置", dependencies.childElementCount ? dependencies : el("p", "无"));
    section("并行开发", planText(task.kickoff || task.parallel));
    if (!sharedAcceptance) section("验收标准", planText(task.acceptance));
    if (task.mergeCriteria) section("合并条件", planText(task.mergeCriteria));

    const branches = el("ul");
    for (const branch of task.branches) {
      const row = el("li");
      row.append(branchLink(branch.name), ` · 独立提交 ${branch.ahead}`);
      branches.append(row);
    }
    section(
      "开发分支", planText(`推荐分支 \`${task.branch}\``),
      branches.childElementCount ? branches : el("p", "当前无对应远程分支"),
    );
    const pullList = el("ul");
    for (const pr of task.pulls) {
      const row = el("li");
      row.append(link(`#${pr.number}`, pr.url), ` · ${prLabels[pr.state]} · `, el("code", pr.branch));
      for (const review of pr.feedback) {
        const feedback = el("div", null, "feedback");
        feedback.append(link(`@${review.reviewer} 请求修改`, review.url));
        if (review.body) feedback.append(el("p", review.body));
        row.append(feedback);
      }
      pullList.append(row);
    }
    section("Pull Requests", pullList.childElementCount ? pullList : el("p", "暂无关联 PR"));
    for (const record of related.filter((item) => item.tasks.includes(task.id))) {
      section("已有开发记录", relatedLink(record), el("p", record.note));
    }
    if (!detail.open) detail.showModal();
    get("task-heading").nextElementSibling.querySelector("button").focus();
    detail.scrollTop = 0;
  }

  const nodes = new Map();
  const layers = get("layers");
  for (let level = 0; level <= Math.max(...tasks.map((task) => task.layer)); level += 1) {
    const group = tasks.filter((task) => task.layer === level);
    const row = el("div", null, "layer");
    row.style.setProperty("--columns", group.length);
    row.style.setProperty("--row-width", `${group.length * 15}rem`);
    for (const task of group) {
      const node = el("button", null, "node");
      node.type = "button";
      node.dataset.state = task.state;
      node.setAttribute("aria-haspopup", "dialog");
      const top = el("span", null, "node-top");
      top.append(el("span", task.id, "task-id"), badge(task.state, labels));
      const prerequisites = el("span", task.dependencies.length ? "前置 · " : "无前置", "node-deps");
      task.dependencies.forEach((id, index) => {
        if (index) prerequisites.append(" / ");
        prerequisites.append(el("span", id));
      });
      node.append(top, el("span", task.title, "node-title"), prerequisites);
      node.addEventListener("click", () => openTask(task));
      nodes.set(task.id, node);
      row.append(node);
    }
    layers.append(row);
  }
  for (const record of related) {
    const row = el("li");
    row.append(relatedLink(record), ` · ${record.tasks.join(" / ")}`, el("p", record.note));
    get("related").append(row);
  }
  get("dashboard").hidden = false;
  showConnections(tasks, nodes);
}

try {
  render(JSON.parse(get("progress-data").textContent));
} catch (error) {
  console.error(error);
  get("load-error").hidden = false;
}
