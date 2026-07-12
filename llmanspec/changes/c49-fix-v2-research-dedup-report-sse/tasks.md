# fix-v2-research-dedup-report-sse — Tasks

## 1. 跨迭代 dedup (P1)

- [ ] `features/research/agent.ts`: `deduplicateResults` 的 seen-set（seenTitles/seenNormalizedUrls）SHALL 用 `state.results`（跨迭代累积）初始化，而非仅当前批 allResults；对齐 v1 `graph.py:518,551`
- [ ] 验证：迭代 1 返回的 URL 在迭代 2 被去重

## 2. report prompt 统一 6 段 (P1)

- [ ] `features/research/agent.ts`: 提取 REPORT_SYSTEM_PROMPT（6 段）为共享常量，`generateReport`（正常完成路径, agent.ts:296-304）与 `generateFinalReport`（finish 路径）共用
- [ ] 移除 generateReport 的 1 行极简 prompt
- [ ] 验证：正常完成路径产出 6 段结构化 report

## 3. SSE status + 富 thinking 事件 (P1)

- [ ] `features/research/router.ts:709-746`: stream loop 中检测状态转换时发 `status` 事件（对齐 v1 `api.py:1037-1058`）
- [ ] `features/research/router.ts:783-785`: 非 plan/search/analyze/summary 步骤发富 `thinking`（带消息文本：reasoning/insight/decision/report_complete 等），对齐 v1 `api.py:1102-1186`
- [ ] 验证：前端能据 status/thinking 维护 UI 状态

## 4. resume 还原 plan + start-node (P1)

- [ ] `features/research/agent.ts:502-526`: `runResearchFromState` 从持久化 steps 还原 search_plan（对齐 v1 `_extract_plan_from_steps`, graph.py:945-972, 1009）
- [ ] 实现 start-node 选择：waiting_user/searching 状态跳过重规划直接进入 WaitForApproval/ExecuteSearches（对齐 v1 `_start_node_for_status`, graph.py:1013-1028）
- [ ] 验证：resume 一个 waiting_user 会话展示原 plan 而非重新生成

## 5. export note 类型对齐 (P1)

- [ ] `features/research/router.ts:606-611`: export note 改 `type=STRUCTURED` + `content={title, text, metadata}`（对齐 v1 `api.py:1434-1448`）
- [ ] 验证：跨版本 export note 可比

## Verification

```bash
cd apps/server && bun typecheck   # MUST pass
cd apps/server && bun test        # research 相关测试 MUST pass，无回归
```

人工：

- 跨迭代去重生效
- 正常完成路径 report 为 6 段结构化
- SSE status/thinking 事件覆盖与 v1 一致
- resume 还原 plan
- export note type=STRUCTURED
