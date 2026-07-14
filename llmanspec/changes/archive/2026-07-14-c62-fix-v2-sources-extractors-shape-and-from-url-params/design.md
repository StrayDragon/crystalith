# c62 Design — extractors 响应形状 + from-url 参数校验

> SSOT: `backend/py/src/crystalith/features/sources/{api_ingest.py,api_schemas.py}`

## 决策

### D1: extractors 响应字段——补齐但适配 v2 单体

v1 ExtractorInfoResponse 字段：`type, plugin_id, enabled, available, display_name, description, priority, requires_api_key, requires_service, error_code, message, recovery_hint, details`。

v2 补齐（适配单体，无 plugin_id）：

- `type`（= v2 当前的 name 值：readability/jina/firecrawl）
- `enabled`（从 config 读 enabled_extractors，默认 true）
- `available`（已有，isAvailable(config)）
- `display_name`（已有）
- `description`（新增，中文描述）
- `priority`（已有）
- `requires_api_key`（已有）
- `requires_service`（新增，jina/firecrawl 为 true，readability 为 false）
- `error_code?` / `message?`（不可用时填写）
- `recovery_hint?`（已有）
- `details?`（可选）
- `plugin_id`：省略（v2 无 plugin host）或置 null

`default_extractor`：改为 `extractors.find(e => e.available)?.type ?? 'readability'`（按可用性，不再硬编码）。

### D2: PATCH extractors 校验

mode MUST ∈ `{inherit_global, custom}`，非法返回 400。
enabled_extractors 条目 MUST ⊆ 已注册 extractor 集合（`{readability, jina, firecrawl}`），非法返回 400。

### D3: from-url extractor + mode + snippet

- `extractor`（可选）：值 MUST ∈ 已注册 extractor 集合，非法返回 400。指定时优先使用该 extractor（若不可用，按 fallback 策略或返回 r12 诊断）。
- `mode`：枚举校验 `{fetch, link}`，默认 `link`。非法值返回 400（不再静默走 fetch）。
- `snippet`（可选，link 模式）：用于构建 link 模式内容（v1 `api_ingest.py:381-390`：`# {title}\n\n{snippet}\n\n来源: {url}`）。v2 当前忽略 snippet。

## 涉及文件

### 修改

- `apps/server/src/features/sources/router.ts` — extractors GET 补字段 + default 按可用性；PATCH 校验；from-url 加 extractor/mode/snippet
- `apps/server/src/shared/extraction/factory.ts` — listExtractorMetadata 补 description/requires_service 字段（如缺）

### 新增测试

- `apps/server/test/sources/extractors-shape.test.ts` — 响应含 type/enabled/description/requires_service；default 按可用性
- `apps/server/test/sources/extractors-patch-validation.test.ts` — 非法 mode/enabled_extractors 返回 400
- `apps/server/test/sources/from-url-params.test.ts` — extractor 指定 + mode 枚举校验 + snippet 构建
