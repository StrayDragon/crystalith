---
depends_on: []
batch: all
---

# c62-fix-v2-sources-extractors-shape-and-from-url-params — extractors 响应形状对齐 + from-url extractor/mode 参数

## Why

2026-07-13 第七轮深度审计发现 sources 域的 extractors 端点响应形状与 from-url 参数处理存在 2 个 P1，违反 `source-ingestion-upload-and-url` 的既有 r8/r10/r12 契约。

### Spec 已要求（MUST，当前违反）

- `source-ingestion-upload-and-url r8` —— "`from-url` MUST 支持 `link|fetch`"（枚举）。v2 把 `mode` 当自由字符串，无枚举校验。
- `source-ingestion-upload-and-url r10` —— "系统 MUST 支持提取器指定、可控 fallback"。v2 from-url 不接受 `extractor` 参数。
- `source-ingestion-upload-and-url r12` —— "当用户显式指定某 extractor 但其不可用时，系统 MUST 返回稳定错误语义"。v2 extractors 端点响应形状偏离 v1，缺诊断字段。

### 实现违反

1. **P1-A：extractors 响应形状偏离**。v2 `GET /extractors`（`router.ts:800-821`）返回的 extractor 项用字段 `name` 而非 v1 的 `type`，缺 `plugin_id/enabled/description/requires_service/error_code/message/details`。extractor 集合是 `readability,jina,firecrawl`（v1 是 `trafilatura,jina,firecrawl,browserless`）。`default_extractor` 硬编码 `'readability'` 而非按可用性计算。PATCH（`router.ts:822-857`）不校验 `mode`/`enabled_extractors` 值。

   **注**：trafilatura→readability 替代和 browserless 缺失属 plugins host 设计决策（v2 单体架构），但**响应字段形状**（type/plugin_id/enabled/description/requires_service/error_code/message/details）和**default_extractor 按可用性计算**是可独立对齐的契约。

2. **P1-B：from-url 丢 `extractor` 参数和 `mode` 枚举校验**。v2 `router.ts:673-797` 不接受 `extractor` 请求字段（v1 `api_schemas.py:233-256` 接受并校验 `{trafilatura,jina,firecrawl,browserless}`）。`mode` 当自由字符串（v1 有严格 `fetch|link` 枚举，v1 `api_schemas.py:166-173`）。v2 忽略 v1 接受的 `snippet` 字段。

### v1 参考（正确行为）

- `backend/py/.../sources/api_ingest.py:79-265` —— ExtractorsListResponse 完整字段 + default_extractor 按可用性。
- `backend/py/.../sources/api_schemas.py:166-173,233-256` —— from-url mode 枚举 + extractor 参数。

## What Changes

1. **`apps/server/src/features/sources/router.ts`** — `GET /extractors` extractor 项补齐字段：`type`（别名 name）、`enabled`、`description`、`requires_service`、`error_code?`、`message?`、`details?`（无 plugin_id 因无 plugin host，置 null 或省略）。`default_extractor` 改为按可用性计算（第一个 `available: true` 的 extractor）。
2. **`apps/server/src/features/sources/router.ts`** — `PATCH /extractors` 校验 `mode ∈ {inherit_global, custom}` 和 `enabled_extractors` 条目合法，非法值返回 400。
3. **`apps/server/src/features/sources/router.ts`** — from-url 加 `extractor` 参数（可选，校验值 ∈ 已注册 extractor 集合）；`mode` 改为枚举校验 `{fetch, link}`（默认 link）；接受 `snippet` 字段用于 link 模式内容构建。
4. **测试** — extractors 响应字段完整性测试 + default_extractor 按可用性测试 + PATCH 校验测试 + from-url extractor/mode 校验测试。

## Capabilities

- `source-ingestion-upload-and-url` —— ADDED `extractors-response-must-align-v1-field-shape`（extractors 响应 MUST 含完整诊断字段 + default 按可用性）+ ADDED `from-url-must-validate-extractor-and-mode-enum`（from-url MUST 校验 extractor + mode 枚举）

## Impact

- **BREAKING（extractors 响应）**：extractor 项新增 `type/enabled/description/requires_service` 字段。旧客户端忽略新字段不受影响。`name` 字段保留（向后兼容）或映射到 `type`。
- **BREAKING（from-url mode）**：非法 mode 值（非 fetch/link）现在返回 400 而非静默走 fetch。行为收紧。
- **风险**：低-中。extractors 字段补全是增量；mode 枚举校验是行为收紧（可能影响传入非法 mode 的现有调用，但非法 mode 本就是错误用法）。
- **依赖**：独立于 c57–c61；不阻塞 c13/c14。
