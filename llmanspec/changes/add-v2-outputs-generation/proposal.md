---
depends_on: [add-v2-core-crud, add-v2-ai-runtime]
---
# add-v2-outputs-generation — 7 种结构化输出类型

## Why

v1 支持 7 种 Output 类型（FAQ/BRIEFING/TIMELINE/MINDMAP/QUIZ/GUIDE/SLIDES 等），通过 pydantic-ai output_type 生成。v2 用 AI SDK generateObject(schema: Zod) 实现，替换 pydantic-graph 的 Output 工作流。

## What Changes

- **NEW** `server/src/features/outputs/` — 每种 Output 类型一个 generateObject 调用 + 前后处理
- **NEW** `packages/shared/src/schemas/outputs.ts` — Zod 输出 schema（前后端共享）
- **MODIFIED** `server/src/ai/` — generateObject wrapper 统一重试/校验

## Capabilities

- generation-core (spec delta: 生成使用 AI SDK generateObject)
- studio-output-types (spec delta: 输出类型 Zod schema)

## Impact

- pydantic-graph 的线性图 (ResolveContext → GenerateOutput → MapCitations → Postprocess → Persist) 替换为普通 async 函数链 + generateObject
- 输出 schema 前后端共享，前端可做 render 时的类型校验
