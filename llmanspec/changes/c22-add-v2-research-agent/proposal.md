---
depends_on: [c16-fix-v2-rag-foundations, c19-add-v2-task-queue]
blocks: [c13-add-v2-distribution, c14-add-v2-cleanup-delivery]
batch: all
---

# c22-add-v2-research-agent — Research 完整复刻

## Why

`docs/V1-V2-DRIFT-ANALYSIS.md` P1-2 揭示 v2 research 是空壳：单次 streamText，无 `maxSteps`、无 `researchSteps` 写入、无 SSE 进度端点、HITL（approve/modify/skip/finish）是 status-flag no-op、cancel 不中断运行中 agent、`/stop` vs `/cancel` 路由文档不符。这是 v1 最复杂功能（pydantic-graph 5 节点状态机 ~2500 行），当前 v2 ~400 行只是骨架。

用户决策：**完整复刻**。本 change 还原 v1 的多轮迭代 + DB-polling SSE + HITL + 锁管理。

## What Changes

- **NEW** `apps/server/src/features/research/state-machine.ts` — 5 节点状态机：PlanSearches→WaitForApproval→ExecuteSearches→AnalyzeResults→GenerateReport（移植 v1 `graph.py`）
- **MODIFIED** `apps/server/src/features/research/router.ts` — 多轮迭代：`need_more_search AND iteration < max_iterations`；写 `researchSteps` 表；修复 /stop vs /cancel 路由/文档
- **NEW** `apps/server/src/features/research/sse.ts` — DB-polling SSE（1s 间隔/3600 次/30s heartbeat），事件：plan_ready/search_progress/analysis/thinking/done（移植 v1 `api.py:944`）
- **MODIFIED** `apps/server/src/features/research/router.ts` — HITL approve/modify/skip/finish/cancel/resume 真中断（AbortController）；锁管理（locked_at/lock_expires_at，LOCK_TIMEOUT=600s，周期续期）
- **MODIFIED** `apps/server/src/features/research/tools.ts` — webSearch（SearXNG）+ analyzeResults（结构化输出 coverage/need_more）+ writeReport

## Capabilities

- knowledge-curation-and-freshness (spec delta: research 状态机 + SSE + HITL)

## Impact

- Research agent 真正多轮迭代（2-4 查询/轮，最多 4 轮）
- DB-polling SSE 实时进度（thinking/plan_ready/search_progress/analysis/report）
- HITL 审批门控（approve/modify/skip），cancel 真中断
- 锁防并发（同 session 不能同时跑）
