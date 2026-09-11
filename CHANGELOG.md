# Changelog

## 0.2.0 — 2026-09-12

- 请求示例改为最多 5 条代表性样本，并优先覆盖不同 HTTP 状态，减少漏看错误响应。
- 兼容缺失或异常的 headers、queryString 与 form 参数数组。
- HAR 中仅出现在 queryString 的参数会同步到示例 URL 和 cURL。

## 0.1.0 — 2026-09-11

首个本地可用版本。功能、限制与后续方向见 README；验收范围见 docs/VALIDATION.md。
