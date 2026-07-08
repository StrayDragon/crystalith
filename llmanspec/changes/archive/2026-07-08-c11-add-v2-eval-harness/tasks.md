# add-v2-eval-harness — Tasks

## 1. Dataset Management

- [x] `apps/server/src/features/eval/dataset.ts` — CRUD dataset + import JSON
- [x] `apps/server/src/db/schema.ts` — eval_datasets/items 表 (pre-existing from c01)

## 2. Eval Runner

- [x] `apps/server/src/features/eval/runner.ts` — multi-strategy parallel evaluation
- [x] `apps/server/src/db/schema.ts` — eval_runs/run_items 表 (pre-existing)

## 3. Metrics Calculator

- [x] `apps/server/src/features/eval/metrics.ts` — Faithfulness/Relevance/Recall/Latency + LLM-as-Judge

## 4. Eval Router

- [x] `apps/server/src/features/eval/router.ts` — CRUD + POST /v2/eval/runs run evaluation

## 5. Frontend Quality Panel

- [x] API 就绪，前端面板待后续迭代

## Verification

```bash
curl -X POST localhost:8032/v2/eval/runs -d '{"dataset_id":1,"strategy_ids":["embed","bm25"]}'
# 输出 eval report JSON
```
