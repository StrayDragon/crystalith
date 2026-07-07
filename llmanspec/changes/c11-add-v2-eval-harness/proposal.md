---
depends_on: [c04-add-v2-core-crud, c06-add-v2-rag-registry]
batch: all
---
# c11-add-v2-eval-harness — Eval / Benchmark 质量体系

## Why

v2 需要量化验收每种 RAG 策略的效果。内置 Eval Benchmark Harness 提供 Golden Dataset 管理 + LLM-as-Judge 打分 + 策略 A/B 对比 + 前端可视化面板。

## What Changes

- **NEW** `server/src/eval/` — Eval dataset CRUD + runner + metrics calculator
- **NEW** `server/src/db/schema.ts` — eval_datasets/items/runs/run_items/metrics 表
- **NEW** `server/src/eval/metrics.ts` — Faithfulness/Relevance/Recall/Precision/Latency
- **NEW** `server/src/eval/judge.ts` — LLM-as-Judge (generateObject 打分)
- **NEW** 前端 — 质量面板 (对比雷达图、逐 QA 对详情、历史趋势)

## Capabilities

- quality-and-regression (spec delta: Eval harness 作为回归检测)
- quality-gates-for-generation (spec delta: 生成质量验收)

## Impact

- 每次 RAG 策略变更后通过 CLI `bun run eval` 跑 benchmark
- 回归检测：Golden Dataset 的 answer 质量不能退化
- 前端质量面板给用户透明度 (为什么选这个策略)
