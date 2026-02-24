## Why

当前 `POST /v1/notebooks/{notebook_id}/sources/from-url` 的 `fetch` 路径允许后端直接对用户提供的 URL 发起请求，缺少对 `localhost`/内网/云元数据地址等目标的拦截，存在 SSRF 风险（信息泄露、内网探测、访问仅对服务端可见的管理端口等）。

同时，source ingest 路径对“确定性用户错误”（例如空文件/空内容）容易返回 500 或产生不必要的失败 Source 记录，导致前端无法区分“用户输入问题”和“服务端故障”，也让 sources 列表出现噪声数据。

## What Changes

### Backend: SSRF 防护（from-url fetch）
- 在任何网络请求发生前，对 URL 进行规范化与安全校验：
  - 仅允许 `http://` 与 `https://`
  - 解析 host 并进行 DNS/直连 IP 校验，拒绝 loopback、link-local、RFC1918 私网、以及常见云元数据地址（例如 `169.254.169.254`）
  - 拒绝不含 host 的 URL、以及可疑/不支持的形式（例如嵌入凭证、无效端口等）
- 增加可配置的“显式允许”模式（allowlist），用于在受控环境下允许特定域名/后缀（或 CIDR）被抓取；默认保持安全拒绝策略。

### Backend: ingest 错误码与记录策略
- 对 `from-url(fetch)` 与 upload ingest 的错误处理做分层：
  - 对明确的 4xx（无效 URL、空内容、无效 extractor、空文件等）保持 4xx 返回，不再被泛化为 500
  - 对确定性用户错误尽量 **不创建 Source 记录**（避免 sources 列表污染）；对运行时失败（解析/嵌入/向量写入）仍保留失败 Source 以便排障
- 统一错误信息长度与日志字段，确保前端可以稳定展示并可在日志中追踪。

### Tests / Docs
- 增加后端测试：SSRF 拦截（localhost/私网/元数据）、allowlist 行为、空文件/空内容返回 400、以及“不创建 Source 记录”的约束。
- 更新配置 schema 与部署文档，说明 SSRF 防护默认行为与 allowlist 的风险提示。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `source-ingestion-url`: 为 `from-url(fetch)` 增加 SSRF 防护与 allowlist/策略配置；补充失败场景的 4xx 语义。
- `source-ingestion-upload`: 明确空文件/空内容的 400 行为与是否创建 Source 记录的规则。
- `config-management`: 增加/完善与 URL fetch 安全相关的配置字段与 schema 校验。

## Impact

- 受影响代码（预计）：
  - `backend/py/src/crystalith/features/sources/api_ingest.py`
  - `backend/py/src/crystalith/shared/extraction/*`（发起网络请求的 extractor）
  - `backend/py/src/crystalith/shared/config/models.py` + `config/app.schema.json`
  - `backend/py/tests/features/sources/*`
- 兼容性：
  - 默认将阻止抓取内网/localhost/元数据等目标；若已有合法用例依赖该能力，需要通过 allowlist 显式放行（并承担相应风险）。
