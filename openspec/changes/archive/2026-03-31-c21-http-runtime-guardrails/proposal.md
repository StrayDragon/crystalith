## Why

当前后端在本地开发（`HOST=127.0.0.1`）路径上默认“低摩擦优先”，但在**非本地暴露**（例如 `HOST=0.0.0.0`、云主机/局域网可访问）场景下，缺少最小的入口级 guardrails：上传端点会把文件一次性读入内存，HTTP 缺少基础 rate limit，容易被误用/滥用触发资源耗尽或抖动。需要把这些 guardrails 收口为**可配置、默认合理、仅对非本地暴露生效**的运行时契约。

## What Changes

- 新增一组 “HTTP runtime guardrails” 配置块（YAML-first + schema 校验），提供合理默认值，并支持 `auto|enabled|disabled` 模式。
- Upload：对文件上传引入**最大读取字节数**限制（防止单请求拉爆内存）；超过阈值返回 413（不创建来源记录），并使用统一错误信封。
- HTTP rate limiting：对 `/v1/**`（或等价的核心 API surface）引入基础限流（按 client/IP 维度），触发时返回 429 + `retry_after`，并保证健康检查端点不受影响。
- Guardrails 生效边界：
  - 默认仅在“非本地暴露”场景启用（例如 bind host 非 loopback）；本地 `127.0.0.1` 保持低摩擦。
  - 允许运维显式强制启用/禁用（覆盖 auto）。

## Capabilities

### New Capabilities
- `http-runtime-guardrails`: 定义非本地暴露时的 HTTP 入口防护契约（启用模式、上传大小限制、API rate limit、429/413 错误语义与 `retry_after`）。

### Modified Capabilities
- `source-ingestion-upload-and-url`: 增加上传大小上限与 413 语义（超限不创建来源记录，错误信封可诊断）。
- `workspace-api-contract`: 明确 429（rate limited）在 HTTP 响应中的稳定语义（错误信封 + `retry_after`），并保持 `/health*` 不受影响。
- `config-and-models`: 增加 guardrails 配置块的 schema 与默认启用策略（auto：仅对非本地暴露生效）。

## Impact

- Backend：
  - 配置模型与 `config/app.schema.gen.json` 将扩展（新增 guardrails 配置与默认值）。
  - Upload ingest 路径需要加入 size gate（413）并保持“确定性输入错误不落库”的语义。
  - 增加 HTTP 中间件/依赖以实现 rate limit（含 `retry_after`）与必要的 client 识别策略（为反代场景预留可配置边界）。
- Frontend / SDK：
  - 需要能稳定展示/处理 413/429 的统一错误信封（已有 error envelope 基线不变，只是新增可预期的错误场景）。
- Ops：
  - 非本地部署默认具备最小的 DoS/误操作防护；本地开发保持低摩擦并可显式覆盖。
