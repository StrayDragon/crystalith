# fix-v2-research-dedup-report-sse — Tasks

## 1. 跨迭代 dedup (P1)

- [x] `features/research/agent.ts`: `deduplicateResults` 加 `accumulated` 入参，seen-set（seenUrls/seenTitles）用 `state.results`（跨迭代累积）初始化；对齐 v1 `graph.py:518,551`
- [x] `executeSearches` 调用点传 `state.results` 作 accumulated seed
- [x] 验证：迭代 1 返回的 URL 在迭代 2 被去重（跨迭代累积 seed 生效）

## 2. report prompt 统一 6 段 (P1)

- [x] `features/research/agent.ts`: 提取 REPORT_SYSTEM_PROMPT（6 段，graph.py:94-128）为模块级常量
- [x] `generateReport`（正常完成路径）+ `generateFinalReport`（finish 路径）共用 REPORT_SYSTEM_PROMPT
- [x] 移除 generateReport 的 1 行极简 prompt
- [x] 验证：正常完成路径产出 6 段结构化 report（与 finish 路径一致）

## 3. SSE status + 富 thinking 事件 (P1)

- [x] `features/research/router.ts` stream loop: 跟踪 lastStatus，状态转换时发 `status` 事件（含 previous/iteration/message），对齐 v1 api.py:1037-1058
- [x] `deriveNamedEvent` default 分支：富 `thinking`（带 message + step_type + outputData），对齐 v1 api.py:1102-1186
- [x] 新增 `thinkingMessageForStep`（从 outputData 的 summary/reasoning 提取，回退到 step type）
- [x] 新增 `statusMessage`（v1 api.py:1044-1050 status_messages 中文映射）
- [x] 验证：前端能据 status/thinking 维护 UI 状态（SSE 测试 28 pass）

## 4. resume 还原 plan + start-node (P1)

- [x] `features/research/agent.ts` ResearchState: 加 `searchPlan?` + `resumeStatus?` 字段
- [x] 新增 `extractPlanFromSteps`（v1 `_extract_plan_from_steps`, graph.py:945-972）：优先 user-modified plan，回退最新 PLAN 步骤
- [x] 新增 `parseSearchPlan` helper（防御性解析持久化 plan payload）
- [x] `runResearchFromState`: 还原 searchPlan（从 steps）+ resumeStatus（从 session.status）
- [x] `runResearchCore`: resumeSkipPlan（waiting_user+plan → 跳过重规划进 HITL）/ resumeSkipHitl（searching+plan → 跳过重规划+HITL 进 search）；对齐 v1 `_start_node_for_status`, graph.py:1013-1028
- [x] 验证：resume 一个 waiting_user 会话展示原 plan 而非重新生成

## 5. export note 类型对齐 (P1)

- [x] `features/research/router.ts:600-616`: export note 改 `type=STRUCTURED` + `content={title, text, metadata}`（含 research_id/research_topic/export_timestamp），对齐 v1 api.py:1434-1448
- [x] 验证：跨版本 export note 可比（type + content schema 与 v1 一致）

## Verification

```bash
cd apps/server && bun typecheck    # ✅ pass
cd apps/server && bun test         # ✅ 209 pass / 2 fail（research 网络 + URL 超时，非回归，与基线一致）
cd apps/server && bun test test/research/  # ✅ 28 pass / 0 fail
```

人工：
- 跨迭代去重生效（seed from state.results）
- 正常完成路径 report 为 6 段结构化（与 finish 路径一致）
- SSE status 事件覆盖状态转换；thinking 事件含 message
- resume waiting_user 展示原 plan；resume searching 直接执行
- export note type=STRUCTURED + content={title,text,metadata}
