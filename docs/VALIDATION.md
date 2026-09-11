# v0.2.0 验证记录

日期：2026-09-12。环境：Windows、Node.js 24.11.0；浏览器测试通过 Playwright 驱动本机浏览器。

- 9 项 Node 核心测试通过：接口归组、敏感字段脱敏、自定义规则、异常 HAR、原型键、正文省略、代表性状态码样本、异常数组兼容、cURL 格式。
- Chrome 浏览器通过：示例导入、接口搜索与选择、用途备注、Markdown 下载、无效文件导入后保留之前结果。
- 1440px 桌面与 390px 窄屏检查通过，没有页面水平溢出。
- CLI 的正常输出、错误输入和错误参数验证通过。
- 页面没有捕获到未处理的 JavaScript 运行错误。

未验收：完整隐私识别（功能不提供）、外部接口可调用性（功能不提供）、原生 WebMCP 集成及线上托管。

## 本地复现核心测试

```bash
npm test
```

GitHub Actions 配置使用 Node.js 22；云端最新结果见 [CI 运行记录](https://github.com/AK1116q/har-to-docs/actions/workflows/ci.yml)。完整交互可按 README 的使用步骤人工复现。
