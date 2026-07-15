---
depends_on: [add-config-ssot-autogen]
batch: false
---

# add-config-schema-descriptions — Zod schema .describe() + .openapi() 描述补充

## Why

当前 Crystalith v2 的 Zod schema 体系虽然类型完备，但缺少人读描述，导致两个下游表现不佳：

### 1. config/app.schema.gen.json 字段描述为空

`apps/server/src/shared/config.ts` 中 11 个 Zod schema、~30 个配置字段**均无 `.describe()`**。
生成的 `config/app.schema.gen.json` 中每个字段的 `description` 为空，VSCode/Neovim hover 无文档提示：

```json
{ "timeout": { "type": "number", "default": 60 } }
// 缺少: "description": "AI 调用超时（秒），范围 1-600"
```

### 2. Scalar UI（/openapi）端点文档不完整

`packages/shared/src/schemas/` 下 17 个 schema 文件、~100+ 字段**均无 `.describe()` 和 `.openapi()`**。
Scalar UI 的请求体/响应体字段只有类型没有描述，开发者体验差。

### 3. 缺少统一描述约定

目前 `env.ts` 用了中文 `.describe()`，其他 schema 什么也没有。没有一个标准化的描述工具链和约定。

## What Changes

### Phase 0: i18n 基础设施

- **NEW** `packages/shared/src/schemas/i18n.ts` — `desc()` helper
  - 签名 `desc(zh: string, _key?: string): string`
  - 目前返回中文原文；未来切换 i18n 后端只需修改此函数
- **MOD** `AGENTS.md` — 新增 "Schema Descriptions & i18n" 节，约定所有 schema 描述使用 `desc()`

### Phase A: config.ts 配置 schema 补充 `.describe(desc(...))`

为以下 11 个 schema 的每个字段添加中文 `.describe()`：

| Schema                        | 字段数 | 示例描述                                       |
| ----------------------------- | ------ | ---------------------------------------------- |
| `AiSettingsSchema`            | 2      | timeout → "AI 调用超时（秒），范围 1-600"      |
| `ConcurrencySettingsSchema`   | 3      | embedding → "嵌入生成最大并发数，0 表示不限制" |
| `EmbeddingSettingsSchema`     | 2      | chunk_size → "文本分块大小（token 数）"        |
| `ContextWindowSettingsSchema` | 3      | compression_strategy → "上下文压缩策略"        |
| `SearXNGSettingsSchema`       | 4      | host → "SearXNG 实例 URL，留空禁用搜索引擎"    |
| `SearchSettingsSchema`        | 1      | searxng → "搜索引擎设置"                       |
| `CompletionOptionsSchema`     | 5      | temperature → "生成温度，0-2"                  |
| `StorageSettingsSchema`       | 1      | data_root → "运行时数据根目录"                 |
| `SsrfPolicyConfigSchema`      | 5      | allowlist_only → "仅允许白名单中的主机"        |
| `AppSettingsSchema`           | 1      | http_guardrails → "HTTP 防护设置"              |
| `OptionalServicesSchema`      | 3      | chroma → "Chroma 向量数据库配置"               |
| `OptionalServiceEntrySchema`  | 3      | enabled → "是否启用该服务"                     |

### Phase B: 共享 API schema 补充 `.openapi()`

`packages/shared/src/schemas/` 下所有 schema：

- 响应体/请求体的**字段**使用 `.openapi({ description: desc(...), example: ... })`
- OpenAPI `tags` 保持现有 feature 级别（notebooks, sessions, sources 等 19 个 tag）

涉及的 schema 文件：notebook, session, message, source, output, research, analysis, studio, refine, qa, model, template, task, eval, common, streaming/*

### Phase C: 验证

- `config/app.schema.gen.json` 每个字段携带中文描述
- `just qa` 全通过
- Scalar UI（/openapi）端点参数/响应字段携带中文描述

## Capabilities

- configuration-governance (delta ops r12–r14)
- openapi-and-client-generation (future Scalar UI validation)

## Impact

- 无运行时行为变化（描述纯元数据）
- `packages/shared/src/schemas/` 文件体积增加约 15-20KB（注释文本）
- `.openapi()` 调用仅影响 OpenAPI 文档生成，不影响 eden treaty 类型
- 需要 `add-config-ssot-autogen` 已完成（提供 JSON Schema 生成 + drift 检测）
