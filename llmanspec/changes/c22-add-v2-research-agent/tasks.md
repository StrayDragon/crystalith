# add-v2-research-agent — Tasks (AI SDK v7 方案)

## 1. Agent 主循环（替代"状态机核心"）

- [ ] 新建 `features/research/agent.ts`: runResearch() for 循环 + ToolLoopAgent + generateObject
- [ ] PlanSearches: `generateObject({ schema: planSearchSchema })` 生成 2-4 查询
- [ ] AnalyzeResults: `generateObject({ schema: analysisSchema })` 返回 coverage+need_more
- [ ] GenerateReport: `streamText` 流式生成 markdown 报告（CANCELLED 不写）
- [ ] while 循环条件: `need_more AND iter < maxIterations AND !signal.aborted`
- [ ] 验证: `bun test test/research/agent.test.ts`（多轮迭代、终止条件、AbortSignal）

## 2. WaitForApproval + HITL（用 toolApproval，不用 DB 轮询）

- [ ] 新建 `features/research/hitl.ts`: toolApproval 审批流程
- [ ] `toolApproval: 'user-approval'` 等用户审批搜索计划
- [ ] approve/modify/skip/finish/cancel: 通过 toolApproval 回调 + AbortController
- [ ] 超时自动 approve: 前端超时逻辑
- [ ] **移除 DB 轮询**，改用事件驱动
- [ ] **移除 DB 锁**（不需要，单用户桌面应用）
- [ ] 验证: `bun test test/research/hitl.test.ts`（各 action 状态转移）

## 3. ExecuteSearches

- [ ] webSearch 并发 cap 3（c19 Semaphore）
- [ ] 结果去重：URL 规范化（c18 canonicalizeUrlForDedup）+ 标题 Jaccard ≥0.85
- [ ] 写 researchSession.aggregatedResults
- [ ] 验证: `bun test test/research/execute.test.ts`（去重、并发）

## 4. SSE 流（rely AI SDK fullStream，不用 DB 轮询）

- [ ] 新建 `features/research/sse.ts`: GET /research/:id/stream
- [ ] relay AI SDK `fullStream` 事件 → SSE 事件
- [ ] 事件映射：text-delta→report_delta, tool-call→search_progress, tool-approval-request→approval_request
- [ ] 验证: `bun test test/research/sse.test.ts`（事件派发、恢复）

## 5. Cancel 真中断（移除 DB 锁）

- [ ] activeResearch 管理 Map<number, AbortController>
- [ ] cancel 路由: AbortController.abort() → runResearch 自然终止
- [ ] 不需要 locked_at/lock_expires_at（单用户）
- [ ] 不需要 _extend_lock_periodically
- [ ] 验证: `bun test test/research/cancel.test.ts`（AbortSignal 中断）

## 6. 路由/文档修复

- [ ] /cancel 路由改为 AbortController（已有 /cancel，不改 URL）
- [ ] 验证: 路由一致性

## 7. 整体验证

- [ ] `cd apps/server && bun test tests/bdd/`（research 域 BDD，AI SDK mock）
- [ ] `bun oxlint apps/server/src/features/research/`（0 error）

## Verification

```bash
cd apps/server
bun test test/research/   # agent/hitl/execute/sse/cancel
bun test tests/bdd/       # research BDD
bun oxlint apps/server/src/features/research/
```
