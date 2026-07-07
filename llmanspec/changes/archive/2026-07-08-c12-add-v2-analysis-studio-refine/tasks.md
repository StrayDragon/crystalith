# add-v2-analysis-studio-refine — Tasks

## 1. Analysis

- [x] `apps/server/src/features/analysis/router.ts` — POST /v2/analysis (聚类 + 矛盾 + 相关性)
- [x] AI SDK tool: analyzeNotebook → generateObject with AnalysisOutputSchema

## 2. Studio

- [x] `apps/server/src/features/studio/router.ts` — POST /v2/studio/slides (生成 Slidev markdown)
- [x] AI SDK streamText → 流式生成每页 slide

## 3. Refine

- [x] `apps/server/src/features/refine/router.ts` — POST /v2/refine (扩展/缩写/重写/翻译)
- [x] 四种 mode 通过不同 system prompt 实现

## 4. Templates & Presets

- [x] `apps/server/src/features/templates/router.ts` — CRUD
- [x] `apps/server/src/features/prompt-presets/router.ts` — CRUD

## 5. Frontend Eden Migration

- [x] Server APIs 就绪 (analysis/studio/refine/research)，前端渐进迁移

## Verification

```bash
curl -X POST localhost:8032/v2/analysis -d '{"notebook_id":1}'
curl -X POST localhost:8032/v2/studio/slides -d '{"notebook_id":1}'
curl -X POST localhost:8032/v2/refine -d '{"text":"...","mode":"summary"}'
```
