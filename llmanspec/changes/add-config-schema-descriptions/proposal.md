---
depends_on: []
batch: false
---

# add-config-schema-descriptions — Zod schema .describe() 补充 + API 分组优化

## Why

当前两个问题：

### 1. YAML config 字段缺少中文描述

`apps/server/src/shared/config.ts` 中 11 个 Zod schema、~30 个字段缺少 `.describe()`，
导致 `config/app.schema.gen.json` 字段描述为空，VSCode hover 不显示文档。

### 2. API Zod schema 缺少 Scalar UI 友好的分组与描述

`packages/shared/src/schemas/` 下 15+ 个 schema 大部分缺少 `.describe()`，
Scalar UI（`/openapi`）端点参数/响应字段没有中文文档和按业务域的分组。

## What Changes

- **Phase A**: 为 `apps/server/src/shared/config.ts` 的 Zod schema 补充 `.describe()`
- **Phase B**: 为 `packages/shared/src/schemas/` 补充 `.describe()` + 按业务域分组（Workspace / Source / Generation / Studio / Model / Evaluation）
- **Phase C**: 验证 `config/app.schema.gen.json` 和 Scalar UI 均携带中文描述

## Capabilities

- configuration-governance
- （future: openapi-and-client-generation）

## Impact

- 不改动 Zod schema 结构和字段，只加 `.describe()`
- 不改动 OpenAPI 路由注册逻辑
- 不改动 Scalar UI 渲染配置
- 需要 `add-config-ssot-autogen` 已归档（JSON Schema 生成基础设施已就绪）
