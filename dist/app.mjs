import { collectHar, markdown, curl } from "./core.mjs";
const $ = (id) => document.getElementById(id);
let raw;
let report;
let selected;
let revision = 0;
let searchTimer;
const status = (text) => {
  $("status").textContent = text;
};
function preview(value) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > 9000
    ? text.slice(0, 9000) +
        "\n…preview truncated; export Markdown for full content"
    : text;
}
function download(text, name) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/markdown;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function analyze(value, label) {
  const next = collectHar(value, $("redact").value.split(","));
  raw = value;
  report = next;
  for (const group of report.endpoints)
    group.searchKey = group.key.toLowerCase();
  selected = report.endpoints[0]?.key;
  $("search").value = "";
  $("export").disabled = !report.endpoints.length;
  $("count").textContent = report.endpoints.length;
  status(
    `${label} · ${report.total} 条请求 → ${report.endpoints.length} 个接口 · 跳过 ${report.skipped} 条`,
  );
  renderList();
  renderDetail();
  return {
    endpoints: report.endpoints.length,
    requests: report.total,
    skipped: report.skipped,
  };
}
async function load(file) {
  if (!file) return;
  const current = ++revision;
  try {
    if (file.size > 25 * 1024 * 1024)
      throw new Error("文件超过 25 MB，请先拆分。");
    const text = await file.text();
    if (current !== revision) return;
    analyze(JSON.parse(text.replace(/^\uFEFF/, "")), file.name);
  } catch (error) {
    if (current === revision)
      status(`导入失败：${error.message}。之前的结果仍保留。`);
  }
}
function renderList() {
  const term = $("search").value.toLowerCase();
  $("list").replaceChildren();
  const groups =
    report?.endpoints.filter((x) => x.searchKey.includes(term)) ?? [];
  const fragment = document.createDocumentFragment();
  for (const group of groups) {
    const button = document.createElement("button");
    button.className = "endpoint" + (selected === group.key ? " selected" : "");
    button.setAttribute("aria-pressed", String(selected === group.key));
    const badge = document.createElement("span");
    badge.className = "method";
    badge.textContent = group.method;
    const path = document.createElement("span");
    path.textContent = group.path;
    const meta = document.createElement("small");
    meta.textContent = `${group.origin} · ${group.count} 次`;
    button.append(badge, path, meta);
    button.onclick = () => {
      selected = group.key;
      renderList();
      renderDetail();
    };
    fragment.append(button);
  }
  $("list").append(fragment);
  if (!groups.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "没有匹配的接口。";
    $("list").append(p);
  }
}
function renderDetail() {
  const target = $("detail");
  target.replaceChildren();
  const group = report?.endpoints.find((x) => x.key === selected);
  if (!group) {
    target.textContent = "暂无可展示的接口。";
    return;
  }
  const title = document.createElement("h2");
  title.textContent = `${group.method} ${group.path}`;
  const meta = document.createElement("p");
  meta.textContent = `${group.origin} · HTTP ${group.statuses.join(" / ")}`;
  const label = document.createElement("label");
  label.htmlFor = "description";
  label.textContent = "用途备注（包含在导出中）";
  const note = document.createElement("textarea");
  note.id = "description";
  note.rows = 2;
  note.placeholder = "例如：按关键词查询视频";
  note.value = group.description;
  note.oninput = () => {
    group.description = note.value;
  };
  const heading = document.createElement("h3");
  heading.textContent = `代表性请求示例（${group.examples.length} 条）`;
  const select = document.createElement("select");
  select.setAttribute("aria-label", "请求示例");
  for (const [index, example] of group.examples.entries()) {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `#${index + 1} · HTTP ${example.status}`;
    select.append(option);
  }
  const content = document.createElement("div");
  function show() {
    content.replaceChildren();
    const example = group.examples[Number(select.value)];
    const fragment = document.createDocumentFragment();
    const items = [
      ["全部查询参数名", group.queryNames],
      ["本次查询参数", example.query],
      ["请求头", example.headers],
      ...(example.body ? [["请求体", example.body.value]] : []),
      ["响应", example.response.value],
      ["cURL · Bash / zsh", curl(example, group.method)],
    ];
    for (const [name, value] of items) {
      const h = document.createElement("h3");
      h.textContent = name;
      const pre = document.createElement("pre");
      pre.textContent = preview(value);
      fragment.append(h, pre);
    }
    content.append(fragment);
  }
  select.onchange = show;
  target.append(title, meta, label, note, heading, select, content);
  show();
}
$("file").onchange = (event) => {
  load(event.target.files[0]);
  event.target.value = "";
};
$("sample").onclick = async () => {
  const current = ++revision;
  try {
    const response = await fetch("sample.har");
    if (!response.ok) throw new Error("无法加载示例");
    const value = await response.json();
    if (current === revision) analyze(value, "内置示例");
  } catch (error) {
    status(error.message);
  }
};
$("apply").onclick = () => {
  if (!raw) return status("请先导入文件。");
  const notes = new Map(report.endpoints.map((x) => [x.key, x.description]));
  try {
    analyze(raw, "已更新脱敏规则");
    for (const group of report.endpoints)
      group.description = notes.get(group.key) ?? "";
    renderDetail();
  } catch (error) {
    status(error.message);
  }
};
$("search").oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderList, 80);
};
$("export").onclick = () => {
  if (report) download(markdown(report), "api-reference.md");
};
for (const event of ["dragenter", "dragover"])
  $("drop").addEventListener(event, (e) => {
    e.preventDefault();
    $("drop").classList.add("drag");
  });
$("drop").addEventListener("dragleave", () =>
  $("drop").classList.remove("drag"),
);
$("drop").addEventListener("drop", (e) => {
  e.preventDefault();
  $("drop").classList.remove("drag");
  load(e.dataTransfer.files[0]);
});
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
  try {
    Promise.resolve(
      document.modelContext.registerTool(
        {
          name: "import_har",
          description:
            "Import a HAR object and display redacted API endpoints locally.",
          inputSchema: {
            type: "object",
            properties: { har: { type: "object" } },
            required: ["har"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute(input) {
            if (!input?.har) throw new Error("har is required");
            ++revision;
            return analyze(input.har, "Agent import");
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(console.warn);
  } catch (error) {
    console.warn(error);
  }
}
