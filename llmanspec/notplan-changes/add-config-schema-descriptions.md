---
status: deferred
priority: low
depends_on: []
---

# add-config-schema-descriptions — Zod schema .describe() 补充 + API 分组优化

## Why

当前两个问题：

### 1. YAML config 字段缺少中文描述

`apps/server/src/shared/config.ts` 中的 Zod schema 未调用 `.describe()`，导致 `config/app.schema.gen.json` 中的字段描述为空：

```json
{
  "timeout": {
    "type": "number",
    "default": 60
    // 缺少 "description": "AI 调用超时（秒）"
  }
}
```

VSCode/Neovim 用户打开 `config/app.yaml` 时，由于 JSON Schema 字段无描述，hover 提示不会显示任何文档。

### 2. API Zod schema 缺少 Scalar UI 友好的分组与描述

`packages/shared/src/schemas/` 下的 15+ 个 Zod schema 虽然类型定义正确，但：

- 大部分缺少 `.describe()` → Scalar UI 的端点参数/响应字段没有文档
- 缺少按业务域分组（`workspace`, `session`, `generation`, `source` 等）的顶层 schema 编排
- `@asteasolutions/zod-to-openapi` 生成的 OpenAPI spec 目前没有利用 `.describe()` 提供的人读描述

## 范围

### Phase A: config.ts Zod schema 补充 `.describe()`

为以下 schema 的每个字段添加 `.describe()`：

| Schema                        | 字段数     | 示例                                          |
| ----------------------------- | ---------- | --------------------------------------------- |
| `AiSettingsSchema`            | 2          | timeout, max_retries                          |
| `ConcurrencySettingsSchema`   | 3          | embedding, vector_search, llm_generate        |
| `EmbeddingSettingsSchema`     | 2          | chunk_size, batch_size                        |
| `ContextWindowSettingsSchema` | 3          | max_tokens, compression_strategy, window_size |
| `SearXNGSettingsSchema`       | 4          | host, api_key, max_results, timeout           |
| `SearchSettingsSchema`        | 1          | searxng                                       |
| `CompletionOptionsSchema`     | 5          | temperature, top_p, top_k, stop, reasoning    |
| `StorageSettingsSchema`       | 1          | data_root                                     |
| `SsrfPolicyConfigSchema`      | 5          | allowlist_only, allowlist_hosts, ...          |
| `AppSettingsSchema`           | 1 (nested) | http_guardrails                               |
| `OptionalServicesSchema`      | 3          | chroma, searxng, cache_redis                  |

### Phase B: 共享 API schema 补充 `.describe()` + 分组优化

为 `packages/shared/src/schemas/` 下所有 schema 补充 `.describe()`，考虑按以下分组重构 OpenAPI tag：

| 分组 Tag   | 包含 Schema                        |
| ---------- | ---------------------------------- |
| Workspace  | notebook, session, message         |
| Source     | source                             |
| Generation | output, research, analysis, refine |
| Studio     | studio, template, task             |
| Model      | model                              |
| Evaluation | eval, qa                           |

### Phase C: 验证

- `config/app.schema.gen.json` JSON Schema 每个字段携带中文描述
- Scalar UI（`/openapi`）每个端点参数/响应字段携带中文描述
- `bun typecheck` 全通过
- `just qa` 全通过

## 非目标

- 不改动 Zod schema 的结构或字段（只加 `.describe()`）
- 不改动 OpenAPI 路由注册逻辑
- 不改动 Scalar UI 的渲染配置

## 依赖

- 本次 change `add-config-ssot-autogen` 已归档（提供 JSON Schema 生成基础设施）
- 建议在 `c13-add-v2-distribution` 完成后实施此优化
