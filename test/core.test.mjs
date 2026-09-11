import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  collectHar,
  markdown,
  scrub,
  shellQuote,
  fence,
  curl,
} from "../dist/core.mjs";
const sample = JSON.parse(
  await readFile(new URL("../dist/sample.har", import.meta.url), "utf8"),
);
test("groups by origin + method + path while merging parameter names", () => {
  const report = collectHar(sample);
  assert.equal(report.endpoints.length, 3);
  const videos = report.endpoints.find((x) => x.path === "/videos");
  assert.equal(videos.count, 2);
  assert.deepEqual(videos.queryNames, ["keyword", "token", "page"]);
});
test("export removes known secrets from query, cookies, request and response bodies", () => {
  const doc = markdown(collectHar(sample));
  for (const secret of [
    "DEMO_COOKIE_ONLY",
    "DEMO_QUERY_TOKEN",
    "DEMO_RESPONSE_TOKEN",
    "DEMO_PASSWORD",
  ])
    assert.ok(!doc.includes(secret), secret);
  assert.ok(doc.includes("REDACTED"));
  assert.ok(doc.includes("javascript"));
});
test("custom fields, nested structures and URL credentials are redacted", () => {
  assert.deepEqual(
    scrub(
      {
        email: "a@b",
        items: [{ api_key: "x" }],
        url: "https://user:pass@example.test/?token=secret#private",
      },
      ["email"],
    ),
    {
      email: "[REDACTED]",
      items: [{ api_key: "[REDACTED]" }],
      url: "https://example.test/?token=%5BREDACTED%5D",
    },
  );
});
test("handles invalid HAR and skips unsupported URLs and missing requests", () => {
  assert.throws(() => collectHar({}), /log.entries/);
  const report = collectHar({
    log: {
      entries: [{}, { request: { method: "GET", url: "file:///private" } }],
    },
  });
  assert.equal(report.skipped, 2);
  assert.equal(report.endpoints.length, 0);
});
test("prototype keys remain data and Markdown fences cannot break out", () => {
  const value = scrub(JSON.parse('{"__proto__":{"token":"hide"}}'));
  assert.equal(Object.getPrototypeOf(value), Object.prototype);
  assert.equal(value.__proto__.token, "[REDACTED]");
  assert.ok(fence("```\ninjected").startsWith("````\n"));
  assert.equal(shellQuote("a'b"), "'a'\"'\"'b'");
});
test("non-JSON bodies and base64 are omitted, sample retention is bounded", () => {
  const item = structuredClone(sample.log.entries[0]);
  item.request.postData = { text: "raw private stuff", mimeType: "text/plain" };
  item.response.content.encoding = "base64";
  item.response.content.text = "cHJpdmF0ZQ==";
  const report = collectHar({ log: { entries: Array(7).fill(item) } });
  assert.equal(report.endpoints[0].count, 7);
  assert.equal(report.endpoints[0].examples.length, 5);
  assert.ok(!markdown(report).includes("raw private stuff"));
  assert.ok(!markdown(report).includes("cHJpdmF0ZQ=="));
});
test("cURL exports valid continuations with quoted request data", () => {
  const group = collectHar(sample).endpoints.find((x) => x.method === "POST");
  const command = curl(group.examples[0], group.method);
  assert.ok(command.includes("\n  -H "));
  assert.ok(command.includes("\n  --data-raw "));
  assert.ok(!command.includes("\n+"));
});
