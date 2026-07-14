---
depends_on: []
batch: all
---

# c57-fix-v2-sources-safety-and-diagnostics — sources 安全归属 + 诊断丰富度 + connector dedup 门控

## Why

2026-07-13 第七轮 v1↔v2 全域深度审计发现 sources / source-connectors 域存在 2 个 P0（安全/正确性）+ 4 个 P1（诊断/缓存/批量响应丰富度）。本 change 一次性对齐 sources 域的安全不变量与失败诊断契约。

### Spec 已要求（MUST，当前违反）

- `source-ingestion-management-and-tags r2` —— "来源操作 MUST 校验 notebook 归属"（推断自列表/删除/re-embed 均嵌在 `/notebooks/{nid}/sources/...` 下并校验 `source.notebook_id`）。v2 单 source 路由（`/sources/:id`）不做归属校验，违反隔离不变量。
- `source-connectors r6`（推断）—— connector 导入 MUST 遵循全局 dedup 配置门控。
- `source-ingestion-core` 失败语义 —— source 失败 MUST 携带 stage-specific error_code + recovery_hint + last_error_at（v1 `api_common.py:310-319` 4 字段；v2 只设 2 字段）。

### 实现违反（P0）

1. **P0-A：单 source 路由不做 notebook 归属校验**。`apps/server/src/features/sources/router.ts` 的 `GET /sources/:id`（:289）、`DELETE /sources/:id`（:313）、`POST /sources/:id/re-embed`（:540）、`GET /sources/:id/chunks`（:521）只取 source id，不验证该 source 属于调用者 notebook。v1 所有 source 操作嵌在 `/notebooks/{nid}/sources/...` 下并校验 `source.notebook_id != notebook_id`（`api_sources.py:229,308,336`）。**跨 notebook 访问风险**。
2. **P0-B：connector dedup 不按配置门控**。`apps/server/src/features/source-connectors/sync.ts:203-215`（`ingestConnectorEntry`）总是无条件计算 `connectorDedupKey` 并调用 `checkDedup`。v1 `source_connectors/api.py:898,1070` 用 `if settings.source_ingestion.dedup.enabled:` 门控。配置关闭 dedup 时 v2 错误复用已有 source 而非新建。

### 实现违反（P1）

3. **P1：batch 操作缺 per-item `results` 数组**。v2 batch re-embed（`router.ts:664-669`）和 batch delete（`:624`）只返回 id 列表 + 计数，丢掉 v1 的 `SourceBatchItemResult[]`（`api_schemas.py:111-126`，per-item error_code + message）。客户端无法知道哪条失败及原因。
4. **P1：re-embed 不清 `errorCode`/`recoveryHint`**。v2 `router.ts:549-553`（单）和 `:641-645`（batch）只设 `errorMessage: null`。v1 清全部 4 字段（`api_common.py:261-263`：error_code/error_message/recovery_hint/last_error_at）。source 行残留陈旧错误码。
5. **P1：ingestion 失败诊断降级**。v2 `pipeline.ts:168` 只设 2 个 stage code（`EMBEDDING_FAILED`/`PARSE_ERROR`）。v1 有 4 个 stage code 含 `VECTOR_STORE_FAILED`（`api_ingest.py:893-924`）+ `recovery_hint` + `last_error_at`。
6. **P1：tags 不失效 sources 缓存**。v2 tag CRUD（`router.ts:358-441`）和 bind/unbind（`:444-518`）从不调 `bumpSourcesEpoch`。v1 每次都调（`api_tags.py:98,115,178,250`）。list-sources 缓存键含 tag 过滤，会返回陈旧 tag 状态。

### v1 参考（正确行为）

- `backend/py/.../sources/api_sources.py:229,308,336` —— notebook 归属校验。
- `backend/py/.../source_connectors/api.py:898,1070` —— `if settings.source_ingestion.dedup.enabled:` 门控。
- `backend/py/.../sources/api_schemas.py:104-126` —— `SourceBatchItemResult` + `SourceBatchReembedResponse` + `SourceBatchDeleteResponse`（含 results 数组）。
- `backend/py/.../sources/api_common.py:260-264` —— re-embed 清 4 字段。
- `backend/py/.../sources/api_ingest.py:893-924` —— 4 stage error codes + recovery_hint + last_error_at。
- `backend/py/.../sources/api_tags.py:98,115,178,250` —— `_invalidate_notebook_source_caches`。

## What Changes

1. **`apps/server/src/features/sources/router.ts`** —— 4 个单 source 路由加 notebook 归属校验：接受 `:nid` param 或 query，查 source 后校验 `source.notebookId === nid`，不匹配抛 404（避免泄露存在性）。路由路径改为 `/notebooks/:nid/sources/:id` 系列（对齐 v1 嵌套），或在现有 `/sources/:id` 上加必需的 `notebook_id` query。
2. **`apps/server/src/features/source-connectors/sync.ts`** —— `ingestConnectorEntry`/`checkDedup` 调用前加 `if (getDedupEnabled())` 门控（复用 `sources/router.ts` 的 `getDedupEnabled()`）。
3. **`apps/server/src/features/sources/router.ts`** —— batch re-embed/delete 响应加 `results: SourceBatchItemResult[]`（每项 `{source_id, ok, error_code?, message?}`）。
4. **`apps/server/src/features/sources/router.ts`** —— re-embed（单+batch）重置 status=processing 时清全部错误字段（errorCode/errorMessage/recoveryHint/lastErrorAt）。
5. **`apps/server/src/features/sources/pipeline.ts`** —— 失败诊断补齐：区分 4 stage（PARSE_ERROR/EMBEDDING_FAILED/VECTOR_STORE_FAILED/INGESTION_FAILED），设 recovery_hint + last_error_at。
6. **`apps/server/src/features/sources/router.ts`** —— tag CRUD + bind/unbind 末尾调 `bumpSourcesEpoch(nid)`。
7. **测试** —— 新增归属校验测试（跨 notebook 访问返回 404）+ connector dedup 门控测试（关闭配置时新建 source）+ batch results 形状测试 + re-embed 清字段测试 + ingestion 诊断测试 + tag 缓存失效测试。

## Capabilities

- `source-ingestion-management-and-tags` —— ADDED r15（单 source 路由 MUST 校验 notebook 归属）+ ADDED r16（batch 操作 MUST 返回 per-item results）+ MODIFIED 现有 re-embed requirement（MUST 清全部错误字段）+ ADDED r17（tag 变更 MUST 失效 sources 缓存）
- `source-ingestion-core` —— ADDED r10（ingestion 失败 MUST 携带 4-stage error_code + recovery_hint + last_error_at）
- `source-connectors` —— ADDED r9（connector 导入 MUST 遵循全局 dedup 配置门控）
- `source-ingestion-upload-and-url` —— 无 spec 改动（归属校验在 management spec）

## Impact

- **BREAKING（路由路径）**：单 source 路由从 `/sources/:id` 改为 `/notebooks/:nid/sources/:id`（对齐 v1 嵌套），或保留扁平路径但加必需 `notebook_id` query。前端需适配。鉴于前端尚未深度消费这些端点（PROGRESS 记录前端迁移进行中），影响有限。
- **BREAKING（batch 响应形状）**：batch re-embed/delete 响应新增 `results` 数组字段。旧客户端忽略新字段不受影响；新客户端可消费 per-item 诊断。
- **安全改进**：修复跨 notebook 访问漏洞。
- **风险**：低-中。归属校验是纯增量检查；dedup 门控是单行 if；诊断字段是增量；batch results 是增量。唯一的风险是路由路径变更影响现有前端调用。
- **依赖**：独立于 c58–c62；不阻塞 c13/c14。
