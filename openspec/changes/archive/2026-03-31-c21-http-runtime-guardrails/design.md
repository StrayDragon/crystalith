## Context

- 当前上传入口会通过 `UploadFile.read()` 一次性把内容读入内存，缺少上限与 413 语义，容易在非本地暴露场景被误用导致资源耗尽。
- 当前 HTTP 层缺少基础 rate limit；虽然内部已有阶段并发 limiter（embedding/vector_search/llm_generate），但它们不覆盖“入口流量/请求洪峰”。
- 本地开发（默认 bind `127.0.0.1`）强调低摩擦；非本地暴露（bind `0.0.0.0` 或非 loopback）需要默认启用最小防护。

## Goals / Non-Goals

**Goals:**
- 提供一组 YAML-first、可被 schema 校验的 HTTP guardrails 配置，并给出合理默认值。
- 在 guardrails 启用时：
  - Upload 以“最大读取字节数”限制单请求内存占用，上限触发返回 413 且不创建 Source 记录。
  - `/v1/**` 提供基础 rate limit，触发返回 429 + `retry_after`（并尽量同时设置 `Retry-After` header）。
- 默认启用策略满足：**仅在非本地暴露场景生效**；本地 bind `127.0.0.1` 不引入额外限制。
- 保持错误返回使用统一错误信封（`error_code/message/details?/retry_after?`）。

**Non-Goals:**
- 不引入复杂的 WAF/DDoS 体系、不承诺对公网攻击的完整防护。
- 不在本 change 中建设 metrics/tracing。
- 不在本 change 中实现分布式（多副本共享）的 rate limit；先提供单进程/单节点基线。
- 不把上传改造成“流式落盘再解析”的新管线（仅做 bounded read + 413）。

## Decisions

1) **配置结构与默认启用策略**
- 新增配置块：`app.http_guardrails`（或等价位置），包含：
  - `mode: auto|enabled|disabled`（默认 `auto`）
  - `upload_max_bytes: int`（合理默认值；与 Nginx `client_max_body_size` 可建议对齐但不强依赖）
  - `rate_limit: { enabled: bool, window_s: int, max_requests: int, key: ip|... }`（基础版本）
- `mode=auto` 的判定以“服务是否对非 loopback 绑定/暴露”为准：
  - 以启动参数（例如 `HOST` env/uvicorn host）作为单一判定来源：当 bind host 为 loopback（`127.0.0.1`/`localhost`/`::1`）则视为本地；否则视为非本地暴露并启用 guardrails。
  - `enabled/disabled` 覆盖 `auto`。

2) **Upload 的 bounded read 与 413 语义**
- 在 upload ingest 路径中，用“分段读取 + 上限检查”替换 `await file.read()`：
  - 读取至 `upload_max_bytes + 1`，若超限立即返回 413（统一错误信封），并确保“不创建 Source 行”的确定性错误语义成立。
  - 在 guardrails 未启用时不施加该限制（保留本地低摩擦）；当运维显式 `enabled` 时无条件执行。

3) **HTTP rate limit 的实现方式**
- 采用 FastAPI middleware 实现最小可用的 rate limit：
  - 作用范围：默认对 `/v1/**` 生效；显式豁免 `/health`、`/health/dependencies`（与现有匿名探活约定一致）。
  - key 策略：默认使用 `request.client.host`（不信任 `X-Forwarded-For`）；后续可在不破坏契约的前提下扩展“受信任代理头”配置。
  - 语义：触发时返回 429，并在 error envelope 中填充 `retry_after`（秒）；同时在响应头设置 `Retry-After`（秒）。

4) **生成物与一致性门禁**
- 新增/修改配置模型后，`config/app.schema.gen.json` 作为生成物必须通过同一 SSOT 生成：
  - SSOT：`backend/py/src/crystalith/shared/config/models.py`（及相关 config 代码）
  - 生成命令：`cd backend/py && just config-schema`
  - 漂移门禁：`cd backend/py && just config-schema-check`

## Risks / Trade-offs

- [单进程限流不共享] → 先作为基线；多副本场景后续可引入 redis/分布式限流实现（不改变对外 429/`retry_after` 语义）。
- [反代场景 IP 识别] → 默认不信任代理头，避免伪造；后续再通过显式配置打开。
- [upload 仍需读入内存] → 通过 max-bytes 将最坏情况上界化；真正的“流式落盘+异步解析”作为后续优化。
- [auto 判定基于 bind host 可能与实际暴露不完全一致] → 提供 `enabled/disabled` 明确覆盖入口，确保运维可控。

## Migration Plan

- 默认 `mode=auto`：
  - 本地 `HOST=127.0.0.1` 行为不变。
  - 非本地 bind 场景会新增 413/429 的可预期错误语义；前端/SDK 只需按既有错误信封处理即可。
- 回滚边界：
  - 运行时可通过 `mode=disabled` 立即关闭 guardrails；
  - 代码回滚不涉及数据迁移。

## Open Questions

- 是否需要对“重写入端点”（upload/from-url/outputs 等）设置单独更低的 rate limit bucket？
- 是否需要将 Nginx `client_max_body_size` 与后端 `upload_max_bytes` 做启动时一致性诊断提示？
- 是否要在后续 change 中把 request-id/correlation-id 注入与 metrics/tracing 纳入同一“runtime guardrails”闭环？
