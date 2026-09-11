# HAR to Docs

[![CI](https://github.com/AK1116q/har-to-docs/actions/workflows/ci.yml/badge.svg)](https://github.com/AK1116q/har-to-docs/actions/workflows/ci.yml)

**把浏览器请求记录，整理成可以阅读和分享的 API 文档。**

Local-first HAR explorer and Markdown API reference generator. No account, no backend, no runtime dependencies.

![接口整理器演示](docs/screenshot.png)

## 为什么做这个

调试网页时，Network 面板里的请求很多，手动整理地址、参数和响应很耗时。HAR to Docs 将同一来源、方法和路径的请求归组，保留参数与响应示例，并生成 Markdown 文档。

它整理你导入的请求记录，不会主动抓取网站，也不会自动调用或验证这些接口。

## 开始使用

需要 Node.js 22 或更新版本；无需 `npm install`。

```bash
npm start
```

打开终端打印的本地地址（默认 `http://127.0.0.1:4173`），点击 **试用示例**，或拖入 `.har` 文件。

如端口被占用，在 PowerShell 中运行：

```powershell
$env:PORT = '42831'
npm start
```

通过本地 HTTP 服务运行；直接双击 HTML 的 `file://` 模式不受支持。

## 如何获得 HAR

在浏览器开发者工具的 Network 面板中记录需要的操作，再使用面板的 HAR 导出功能。不同浏览器的菜单名称会有所不同。只导出必要的请求，导入后检查脱敏效果；如果导出文件没有响应正文，本工具会明确显示“响应未包含”。

## 功能

- 按 **来源 + 请求方法 + 路径** 归组，保留请求次数、状态码和查询参数名。
- 查看最多 5 条代表性请求示例、请求头、查询参数、请求体及 JSON 响应，并优先覆盖不同 HTTP 状态。
- 按域名、路径和方法搜索；为每个接口添加用途备注。
- 默认隐藏常见令牌、密码、Cookie、授权和签名字段；支持额外字段名。
- 导出 Markdown 文档和 Bash/zsh 格式的 cURL 示例。
- 单文件上限 25 MB，最多 20,000 条请求。

## 命令行

```bash
node bin/cli.mjs dist/sample.har
node bin/cli.mjs dist/sample.har -o api.md
node bin/cli.mjs dist/sample.har --redact email,user_id -o redacted-api.md
```

输出文件已存在时会报错，以免覆盖已有文档。省略 `-o` 时写到标准输出。额外字段按名称、不区分大小写匹配，不支持路径表达式。

## 脱敏边界

查询参数、结构化请求体和 JSON 响应会递归处理常见敏感字段；URL 中的账号、密码和片段会移除。请求头只保留 Accept、Content-Type、Accept-Language 的非敏感值，其余值隐藏。非 JSON 自由文本正文、Base64 响应和文件内容省略。

字段名脱敏不是完整的隐私识别：路径中的账号、自然语言正文中的个人信息、未知字段、嵌在字符串里的 JSON 等仍可能保留。分享前必须人工检查；用途备注也是导出内容。页面刷新会清除导入数据和备注，没有云端或浏览器持久化。

## 当前限制

- 这是一份观察到的请求样本，不是官方 API 合约；字段名列表不推断必填、类型约束或授权范围。
- 不会将 `/users/1` 与 `/users/2` 推断成一个路径模板。
- 每组最多保留 5 个代表性示例，后续请求继续贡献次数、状态码和参数名。
- cURL 是整理后的示例；脱敏后通常不能直接通过认证。multipart 文件上传、缺失正文和平台签名不能据此重放。
- 非 HTTP(S) 请求跳过；不解析 WebSocket 帧、Protobuf、gRPC 或 Base64 正文。
- JSON 数字遵循 JavaScript 精度规则；超大整数 ID 应在原始数据中使用字符串。

## 开发与验证

```bash
npm test
```

核心由 `dist/core.mjs` 提供，浏览器和 CLI 使用同一实现。测试覆盖归组、跨层脱敏、异常输入、原型字段、Markdown 围栏与 cURL 引号。

`dist/` 是手写且跟踪的静态源码，可独立部署到静态托管服务；当前交付未发布线上站点。可选 WebMCP 接口仅在浏览器支持时注册，不影响普通使用。

查看 [验证记录](docs/VALIDATION.md) 与 [贡献说明](CONTRIBUTING.md)。

## 后续方向

- 导出 OpenAPI 初稿，并明确区分样本推断和人工确认。
- 导出 OpenAPI 初稿前的人工校对清单。
- 对两次请求记录生成接口变更摘要。

## License

[MIT](LICENSE)
