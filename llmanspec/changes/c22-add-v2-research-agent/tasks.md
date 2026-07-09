# add-v2-research-agent — Tasks (AI SDK v7 方案)

## ⚠️ Design only — not yet implemented. All tasks pending.

## 1. Agent 主循环 ✅

- [x] 新建 `features/research/agent.ts`: runResearch() for 循环 + generateObject + streamText
- [x] PlanSearches: `generateObject({ schema: planSearchSchema })` 生成 2-4 查询
- [x] AnalyzeResults: `generateObject({ schema: analysisSchema })` 返回 coverage+need_more
- [x] GenerateReport: `streamText` 流式生成 markdown 报告（CANCELLED 不写）
- [x] while 循环条件: `need_more AND iter < maxIterations AND !signal.aborted`
- [ ] 验证: `bun test test/research/agent.test.ts`（多轮迭代、终止条件、AbortSignal）

## 2. WaitForApproval + HITL ⚠️（使用 DB polling 兼容现有前端）

- [x] `features/research/agent.ts`: waitForApproval DB polling（500ms/10min 超时 auto-approve）
- [ ] `toolApproval: 'user-approval'` 事件驱动（待前端适配后切换）
- [x] approve/skip/finish/cancel 路由操作 DB status
- [x] **不需要 DB 锁**（单用户桌面应用）
- [ ] 验证: `bun test test/research/hitl.test.ts`（各 action 状态转移）

## 3. ExecuteSearches ✅

- [x] webSearch 并发 cap 3（Semaphore）
- [x] 结果去重：URL 规范化 normalization + 去重
- [x] 写 researchSession.aggregatedResults
- [ ] 验证: `bun test test/research/execute.test.ts`（去重、并发）

## 4. SSE 流 ✅

- [x] GET /research/:id/stream — poll-based SSE（1s 轮询）
- [x] 事件映射：plan→plan_ready, search→search_progress, analyze→analysis, done
- [ ] 验证: `bun test test/research/sse.test.ts`（事件派发、恢复）

## 5. Cancel 真中断 ✅

- [x] activeResearch 管理 Map<number, AbortController>
- [x] cancel 路由: AbortController.abort() → runResearch 自然终止
- [x] 不需要 DB 锁
- [ ] 验证: `bun test test/research/cancel.test.ts`（AbortSignal 中断）

## 6. 路由 ✅

- [x] router.ts 使用 AbortController
- [x] /cancel/cancel/resume/approve/export 全部移植

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
