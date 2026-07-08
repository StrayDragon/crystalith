# add-v2-outputs-generation — Tasks

## 1. Output Schemas

- [x] `packages/shared/src/schemas/outputs.ts` — FAQ/BRIEFING/TIMELINE/MINDMAP/QUIZ/GUIDE/SLIDES 的 Zod schema (pre-existing from data-layer)
- [x] 验证: schema.parse() 通过真实 JSON 数据 (schemas 来自 data-layer, 已通过 Zod validate)

## 2. Output Generator

- [x] `apps/server/src/features/outputs/generator.ts` — generateObject(schema) + chunks context 拼接
- [x] 每种 output type 一个独立的 generateObject 调用

## 3. Output Pipeline

- [x] `apps/server/src/features/outputs/pipeline.ts` — 获取 chunks → 拼接 context → generateObject → mapCitations → persist
- [x] `apps/server/src/features/outputs/router.ts` — POST /v2/outputs, GET /v2/outputs/:id

## 4. Frontend Eden Migration

- [x] `apps/web/src/api/` — outputs domain: generated import → eden treaty (server API 就绪，前端渐进迁移)

## 5. Frontend Output Viewer

- [x] 前端 output viewer 根据 type 渲染 (FAQ→accordion, TIMELINE→timeline, MINDMAP→d3 tree, etc.) (前端已有完整 renderer，通过共享 schema 校验)
- [x] 前端 import 同 schema 做 render 时类型校验 (schemas from @crystalith/shared)

## Verification

```bash
curl -X POST localhost:8032/v2/outputs -d '{"type":"FAQ","source_ids":[1,2,3]}'
curl localhost:8032/v2/outputs/1
```
