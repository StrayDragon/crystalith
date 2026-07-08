# add-v2-analysis-studio-refine — Tasks

## 1. Analysis

- [ ] `apps/server/src/features/analysis/router.ts` — POST /v2/analysis (聚类 + 矛盾 + 相关性)
- [ ] AI SDK tool: analyzeNotebook(notebookId) → 分析报告

## 2. Studio

- [ ] `apps/server/src/features/studio/router.ts` — POST /v2/studio/slides (生成 Slidev markdown)
- [ ] AI SDK streamText → 流式生成每页 slide

## 3. Refine

- [ ] `apps/server/src/features/refine/router.ts` — POST /v2/refine (扩展/缩写/重写/翻译)
- [ ] 四种 mode 通过不同 system prompt 实现

## 4. Templates & Presets

- [ ] `apps/server/src/features/templates/router.ts` — CRUD + Nunjucks 渲染
- [ ] `apps/server/src/features/prompt-presets/router.ts` — CRUD

## Verification

```bash
curl -X POST localhost:8032/v2/analysis -d '{"notebook_id":1}'
curl -X POST localhost:8032/v2/studio/slides -d '{"notebook_id":1}'
curl -X POST localhost:8032/v2/refine -d '{"text":"...","mode":"summary"}'
```
