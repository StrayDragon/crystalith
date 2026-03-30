## 1. 配置与 schema（SSOT + 漂移门禁）

- [x] 1.1 在 `backend/py/src/crystalith/shared/config/models.py` 增加 `app.http_guardrails` 配置模型（`mode`, `upload_max_bytes`, `rate_limit.*`）并提供默认值（`mode=auto`）。
- [x] 1.2 在后端装配处实现 `mode=auto` 的“非 loopback 暴露”判定（以服务 listen host 为准），并支持 `enabled/disabled` 覆盖。
- [x] 1.3 运行并提交生成的配置 schema：`cd backend/py && just config-schema`（SSOT：配置模型；生成物：`config/app.schema.gen.json`）。
- [x] 1.4 增加/更新漂移门禁验证：`cd backend/py && just config-schema-check`（确保 CI/pre-commit 可检测 schema 漂移）。

## 2. Upload bounded read（413 + 不落库）

- [x] 2.1 在 upload ingest 路径把 `await file.read()` 改为 bounded read（读取至 `upload_max_bytes + 1`），并在超限时返回 413。
- [x] 2.2 统一 413 错误语义：`error_code=PAYLOAD_TOO_LARGE`，`details.max_bytes=<upload_max_bytes>`，并确保该错误路径不创建 Source 行（确定性输入错误不落库）。
- [x] 2.3 仅在 guardrails 启用时执行 upload 上限（`mode=auto` 在 loopback bind 下默认不启用；`mode=enabled` 强制启用）。

## 3. HTTP rate limit（429 + retry_after）

- [x] 3.1 实现 FastAPI middleware 的最小 rate limiter（作用范围：默认 `/v1/**`；默认 key：直接连接的 client 地址；默认不信任 `X-Forwarded-For`）。
- [x] 3.2 在触发时返回 429 + 统一错误信封，并提供 `retry_after`（同时尽量设置 `Retry-After` header）。
- [x] 3.3 豁免健康检查端点：`/health` 与 `/health/dependencies` 不应被 rate limit 拦截。
- [x] 3.4 仅在 guardrails 启用时挂载该 middleware。

## 4. 测试与验证

- [x] 4.1 增加后端测试：upload 超限返回 413 且不创建 Source；upload 未超限保持可用。
- [x] 4.2 增加后端测试：rate limit 触发返回 429 且包含 `retry_after`；健康检查端点不受影响。
- [x] 4.3 运行并记录验证命令结果：
  - [x] `cd backend/py && just test`
  - [x] `cd backend/py && just config-schema-check`

## 5. 手动验收（本地 vs 非本地暴露）

- [x] 5.1 本地开发（loopback bind）：以默认 `HOST=127.0.0.1` 启动后端，确认 guardrails 默认不启用（不会因 rate limit/上传上限影响正常调试）。
- [x] 5.2 非本地暴露（非 loopback bind）：以 `HOST=0.0.0.0`（或生产 compose 等价入口）启动后端，确认：
  - [x] upload 超限返回 413 + `PAYLOAD_TOO_LARGE`
  - [x] `/v1/**` 可触发 429 + `retry_after`
  - [x] `/health*` 不受影响
