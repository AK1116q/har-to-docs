const MASK = "[REDACTED]";
const sensitive =
  /password|passwd|pwd|token|secret|authorization|cookie|session|sessdata|bili[_-]?jct|csrf|api[_-]?key|signature|^sign$|^w_rid$/i;
const safeHeaders = new Set(["accept", "content-type", "accept-language"]);
const plain = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export function isSensitive(key, extra = []) {
  return (
    sensitive.test(key) ||
    extra.some((x) => x && String(key).toLowerCase() === x.toLowerCase())
  );
}
export function scrub(value, extra = [], depth = 0) {
  if (depth > 64) return "[Depth limit]";
  if (Array.isArray(value)) return value.map((x) => scrub(x, extra, depth + 1));
  if (plain(value))
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isSensitive(key, extra) ? MASK : scrub(item, extra, depth + 1),
      ]),
    );
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    try {
      return cleanUrl(value, extra);
    } catch {
      return "[Invalid URL]";
    }
  }
  return value;
}
function cleanUrl(raw, extra) {
  const url = new URL(raw);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("Unsupported URL scheme");
  url.username = "";
  url.password = "";
  url.hash = "";
  for (const key of [...new Set(url.searchParams.keys())]) {
    if (isSensitive(key, extra)) url.searchParams.set(key, MASK);
  }
  return url.href;
}
function body(post, extra) {
  if (!post) return null;
  if (Array.isArray(post.params) && post.params.length)
    return {
      format: "parameters",
      value: post.params.map((x) => ({
        name: String(x.name ?? ""),
        value: x.fileName
          ? "[File omitted]"
          : isSensitive(String(x.name), extra)
            ? MASK
            : scrub(String(x.value ?? ""), extra),
      })),
    };
  if (!post.text) return null;
  try {
    return { format: "json", value: scrub(JSON.parse(post.text), extra) };
  } catch {}
  if (String(post.mimeType).includes("application/x-www-form-urlencoded"))
    return {
      format: "parameters",
      value: [...new URLSearchParams(post.text)].map(([name, value]) => ({
        name,
        value: isSensitive(name, extra) ? MASK : scrub(value, extra),
      })),
    };
  return {
    format: "omitted",
    value: "[Non-JSON body omitted; inspect the original locally]",
  };
}
function responseExample(response, extra) {
  const content = response?.content;
  if (!content?.text)
    return {
      format: "unavailable",
      value: "[Response body not included in HAR]",
    };
  if (content.encoding === "base64")
    return { format: "omitted", value: "[Base64 content omitted]" };
  try {
    return { format: "json", value: scrub(JSON.parse(content.text), extra) };
  } catch {
    return { format: "omitted", value: "[Non-JSON response omitted]" };
  }
}
export function collectHar(har, extra = []) {
  if (!Array.isArray(har?.log?.entries))
    throw new Error("不是有效 HAR：缺少 log.entries 数组。");
  if (har.log.entries.length > 20000)
    throw new Error("最多支持 20,000 条请求，请拆分文件。");
  extra = extra.map((x) => String(x).trim()).filter(Boolean);
  const groups = new Map();
  let skipped = 0;
  for (const entry of har.log.entries) {
    const request = entry?.request;
    if (
      !request ||
      typeof request.url !== "string" ||
      !/^[A-Z]+$/i.test(request.method ?? "")
    ) {
      skipped++;
      continue;
    }
    let url;
    try {
      url = new URL(cleanUrl(request.url, extra));
    } catch {
      skipped++;
      continue;
    }
    const method = request.method.toUpperCase();
    const key = `${method} ${url.origin}${url.pathname}`;
    if (!groups.has(key))
      groups.set(key, {
        key,
        method,
        origin: url.origin,
        path: url.pathname,
        count: 0,
        statuses: [],
        queryNames: [],
        examples: [],
        description: "",
      });
    const group = groups.get(key);
    group.count++;
    const status = Number(entry.response?.status) || 0;
    if (!group.statuses.includes(status)) group.statuses.push(status);
    const query = [...url.searchParams].map(([name, value]) => ({
      name,
      value,
    }));
    // HAR exporters can include queryString even when the URL does not.
    for (const item of Array.isArray(request.queryString)
      ? request.queryString
      : []) {
      const name = String(item.name ?? "");
      if (!query.some((x) => x.name === name))
        query.push({
          name,
          value: isSensitive(name, extra)
            ? MASK
            : scrub(String(item.value ?? ""), extra),
        });
    }
    for (const { name } of query)
      if (!group.queryNames.includes(name)) group.queryNames.push(name);
    // Preserve a bounded set of examples; every request still contributes to counts and parameter names.
    if (group.examples.length < 5)
      group.examples.push({
        url: url.href,
        status,
        query,
        headers: (Array.isArray(request.headers) ? request.headers : []).map(
          (x) => ({
            name: String(x.name ?? ""),
            value:
              isSensitive(String(x.name), extra) ||
              !safeHeaders.has(String(x.name).toLowerCase())
                ? MASK
                : String(x.value ?? ""),
          }),
        ),
        body: body(request.postData, extra),
        response: responseExample(entry.response, extra),
      });
  }
  return {
    total: har.log.entries.length,
    skipped,
    endpoints: [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)),
    extra,
  };
}
export function shellQuote(value) {
  return "'" + String(value).replaceAll("'", "'\"'\"'") + "'";
}
export function curl(example, method) {
  const parts = [`curl -X ${method} ${shellQuote(example.url)}`];
  for (const header of example.headers)
    if (header.value !== MASK)
      parts.push(`-H ${shellQuote(`${header.name}: ${header.value}`)}`);
  if (example.body?.format === "json")
    parts.push(`--data-raw ${shellQuote(JSON.stringify(example.body.value))}`);
  if (example.body?.format === "parameters")
    for (const param of example.body.value)
      parts.push(
        `--data-urlencode ${shellQuote(`${param.name}=${param.value}`)}`,
      );
  return parts.join(" " + String.fromCharCode(92, 10) + "  ");
}
export function fence(value, language = "") {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  let size = 3;
  for (const match of text.matchAll(/`+/g))
    size = Math.max(size, match[0].length + 1);
  const marker = "`".repeat(size);
  return `${marker}${language}\n${text}\n${marker}`;
}
export function markdown(report) {
  const parts = [
    "# API 接口清单",
    "",
    `共 ${report.total} 条请求，${report.endpoints.length} 个接口，跳过 ${report.skipped} 条无效请求。`,
    "",
    "> 此文档来自请求样本，并非官方 API 合约。示例最多保留每接口前 5 条；仅按字段名脱敏，不保证清除所有隐私信息。分享前请检查路径、正文和自定义字段。cURL 为 Bash/zsh 语法，脱敏后通常不能直接认证。",
    "",
  ];
  for (const group of report.endpoints) {
    parts.push(
      `## ${group.method} ${group.path.replace(/[\r\n]/g, "")}`,
      "",
      `来源：${group.origin} · 请求 ${group.count} 次 · 状态 ${group.statuses.join(", ")}`,
      "",
    );
    if (group.description) parts.push(fence(group.description, "text"), "");
    parts.push("### 查询参数", fence(group.queryNames), "");
    for (const [index, example] of group.examples.entries()) {
      parts.push(
        `### 示例 ${index + 1} · HTTP ${example.status}`,
        "",
        fence(example.query, "json"),
        "",
        "请求头（敏感及非白名单值已隐藏）：",
        fence(example.headers, "json"),
      );
      if (example.body)
        parts.push(
          "请求体：",
          fence(
            example.body.value,
            example.body.format === "json" ? "json" : "text",
          ),
        );
      parts.push(
        "响应：",
        fence(
          example.response.value,
          example.response.format === "json" ? "json" : "text",
        ),
        "",
        "调用示例：",
        fence(curl(example, group.method), "bash"),
        "",
      );
    }
  }
  return parts.join("\n");
}
