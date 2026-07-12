# c49-fix-v2-research-dedup-report-sse — Design

## 关键决策

### D1: 跨迭代 dedup

`agent.ts` 的 `deduplicateResults` 入参加入 `state.results`（累积），用它初始化 seen-set；当前仅传当前批 allResults。对齐 v1 `graph.py:518,551`。

### D2: report prompt 统一

提取 REPORT_SYSTEM_PROMPT（6 段，已存在于 `generateFinalReport`）为模块级常量，`generateReport`（正常完成路径）改用它，删除 1 行极简 prompt。

### D3: SSE status/thinking

在 `router.ts` stream loop 里：跟踪上一次 status，转换时发 status 事件；非 plan/search/analyze/summary 步骤映射到富 thinking 消息（对齐 v1 status_messages 与 per-step reasoning 字典）。

### D4: resume 还原 plan

`runResearchFromState` 新增 plan 还原逻辑：从 researchSteps 里找最后一个 PLAN 步骤的 output_data 作为 searchPlan；若 status=waiting_user/searching 且有 plan，跳过 planSearches 直接进入 WaitForApproval/ExecuteSearches（对齐 v1 `_start_node_for_status`）。

### D5: export note 类型

`router.ts:606-611` 改 type=STRUCTURED + content={title, text, metadata}（对齐 v1）。BRIEFING 改 STRUCTURED 是契约收敛（v1 是 SSOT）。

## 迁移与回滚

- 无 DB schema 变更；export note type 改正（v1 才是 SSOT）。
- 回滚 = git revert。
