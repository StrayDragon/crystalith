---
depends_on: []
batch: all
---

# c49-fix-v2-research-dedup-report-sse — Research 跨迭代 dedup + 双路径 report prompt + SSE 事件覆盖 + resume plan + export note 类型

## Why

2026-07-12 第四轮深度复核发现 research 域存在 **5 个 P1**（c37 tasks 全勾但多处 over-reported；c46 tasks 把这些归入"未做（P1 但依赖较多/影响小，可后置）"——本 change 把它们正式追踪）。

### P1-1 — 跨迭代 dedup 丢失（c46 "dedup 增强" 承诺误导）

- **v1** (`graph.py:517-562`): `deduplicateResults` 的 seen-set（`seen_titles`/`seen_normalized_urls`）用 `state.all_results`（**跨所有先前迭代累积**）初始化。
- **v2** (`agent.ts:161,178,265`): `deduplicateResults(allResults)` 里的 `allResults` 只是**单批** executeSearches 的结果，不跨迭代。同一 URL/title 在迭代 2 后会重复进入 `state.results`。
- c46 的 "search dedup 增强" 只加了 URL query/fragment strip（小改进），却丢了跨迭代 dedup（回归）。注释自陈 "equivalent"，实为回归。

### P1-2 — 正常完成路径 report prompt 极简（c46 半数兑现）

- **v1** (`graph.py:94-128`): `REPORT_SYSTEM_PROMPT` 6 段（Executive Summary/Background/Key Findings/Analysis/Recommendations/References）。
- **v2** 两条路径：
  - `generateFinalReport` (`agent.ts:549-583`, finish 路径) ✅ 用 v1 6 段 prompt。
  - `generateReport` (`agent.ts:296-304`, 正常完成路径) ❌ 用 1 行 `"You are a research report writer. Produce a comprehensive markdown report."`。
- c46 承诺的 "report 富 prompt matching v1" 只在 finish 路径兑现；正常完成是更常见的路径，质量显著低于 v1。

### P1-3 — SSE 事件覆盖严重不足（c37 task over-reported）

- **v1** (`api.py:1037-1186`): 发 `status`（每次状态转换）、富 `thinking`（状态消息、迭代变更、reasoning/insight/decision/report_complete 等）。
- **v2** (`router.ts:709-746,783-785`): 完全不发 `status`；非 plan/search/analyze/summary 步骤塌缩成无消息的 `thinking`。前端依赖 status/thinking 维护 UI 状态会回归。
- c37 "SSE 命名事件" task 只兑现了 wire format（event 名），未兑现事件覆盖度。

### P1-4 — Resume 不还原 plan（c24-B/c37 承诺半兑现）

- **v1** (`graph.py:945-972, 1009, 1013-1028`): `_extract_plan_from_steps` 还原 search_plan；`_start_node_for_status` 可跳过重规划直接进 WaitForApproval/ExecuteSearches。
- **v2** (`agent.ts:502-526`): `runResearchFromState` 只还原 iteration+results，**总是重新 planSearches**（`agent.ts:334-337`）。resume 一个 waiting_user 会话会重新生成 plan 而非展示用户即将审批的那个。

### P1-5 — Export note 类型错（c46 明确 deferral，本 change 追踪）

- **v1** (`api.py:1434-1448`): `type=STRUCTURED` + `content={title, text, metadata}`。
- **v2** (`router.ts:606-611`): `type=BRIEFING` + `content={title, sections:[{heading, points}]}`。两者 type 与 content schema 均不兼容。
- c46 tasks "未做" 区明列此项，本 change 正式追踪。

## What Changes

1. **跨迭代 dedup**: `agent.ts` 的 dedup seen-set 用 `state.results`（累积）初始化而非仅当前批；对齐 v1 `graph.py:518,551`。
2. **report prompt 统一**: `generateReport`（正常完成路径）改用 v1 6 段 REPORT_SYSTEM_PROMPT；与 `generateFinalReport` 共享同一 prompt 常量。
3. **SSE status/thinking 覆盖**: 在 stream loop 里发 status 事件（状态转换时）；非 plan/search 步骤发富 thinking（消息文本）。
4. **resume 还原 plan**: `runResearchFromState` 从持久化 steps 还原 search_plan；支持 start-node 选择（waiting_user/searching 跳过重规划）。
5. **export note 类型对齐**: type=STRUCTURED + content={title,text,metadata}（与 v1 一致）。

## Capabilities

- `knowledge-curation-and-freshness`（spec delta: 跨迭代 dedup + report prompt 一致 + SSE 事件覆盖 + resume plan + export note 类型）

## Impact

- **去重回归 v1**: 跨迭代不再出现重复 URL/title。
- **report 质量一致**: 正常完成与 finish 路径产出同质量的 6 段 report。
- **前端 SSE 可用**: 依赖 status/thinking 的 UI 不再回归。
- **resume 行为正确**: 用户能继续审批原 plan 而非被迫重新审。
- **export note 跨版本可比**: STRUCTURED 类型与 v1 一致。
- **无 BREAKING**: 端点路径不变；SSE 事件名为新增；export note type 改正（v1 才是契约 SSOT）。
