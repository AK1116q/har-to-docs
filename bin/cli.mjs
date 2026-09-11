#!/usr/bin/env node
import { readFile, writeFile, stat } from "node:fs/promises";
import { collectHar, markdown } from "../dist/core.mjs";
const args = process.argv.slice(2);
try {
  if (!args.length || args.includes("--help")) {
    console.log(
      "用法：node bin/cli.mjs input.har [-o api.md] [--redact email,user_id]\n省略 -o 时向标准输出写入 Markdown。只读取本地文件，不发送请求。",
    );
  } else {
    const input = args.shift();
    let output;
    let extra = [];
    while (args.length) {
      const flag = args.shift();
      const value = args.shift();
      if (!value || !["-o", "--redact"].includes(flag))
        throw new Error("无效参数；使用 --help 查看用法。");
      if (flag === "-o") output = value;
      else extra = value.split(",");
    }
    if ((await stat(input)).size > 25 * 1024 * 1024)
      throw new Error("文件超过 25 MB。");
    const report = collectHar(
      JSON.parse((await readFile(input, "utf8")).replace(/^\uFEFF/, "")),
      extra,
    );
    const result = markdown(report);
    if (output) {
      await writeFile(output, result, { flag: "wx" });
      console.error(`已导出 ${report.endpoints.length} 个接口到 ${output}`);
    } else process.stdout.write(result + "\n");
  }
} catch (error) {
  console.error(`错误：${error.message}`);
  process.exitCode = 1;
}
