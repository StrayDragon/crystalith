# add-v2-eval-harness — Tasks

## 1. Dataset Management

- [ ] `apps/server/src/eval/dataset.ts` — CRUD dataset + import JSON/CSV
- [ ] `apps/server/src/db/schema.ts` — eval_datasets/items 表

## 2. Eval Runner

- [ ] `apps/server/src/eval/runner.ts` — multi-strategy parallel evaluation
- [ ] `apps/server/src/db/schema.ts` — eval_runs/run_items 表

## 3. Metrics Calculator

- [ ] `apps/server/src/eval/metrics.ts` — Faithfulness/Relevance/Recall/Latency
- [ ] `apps/server/src/eval/judge.ts` — LLM-as-Judge via generateObject

## 4. CLI Harness

- [ ] `apps/server/src/eval/cli.ts` — `bun run eval` 入口 → 跑全部 strategy × dataset
- [ ] 输出 JSON report

## 5. Frontend Quality Panel

- [ ] 策略对比雷达图
- [ ] 逐 QA 对详情 + 历史趋势
- [ ] 回归检测标记

## Verification

```bash
cd apps/server && bun run eval --strategies embed,bm25 --dataset golden-v1
# 输出 eval_report.json
```
