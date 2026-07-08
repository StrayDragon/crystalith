# add-v2-research-agent — Tasks (AI SDK v7 方案)

## ⚠️ Design only — not yet implemented. All tasks pending.

## 1. Agent 主循环 ✅

- [x] 新建 `features/research/agent.ts`: runResearch() for 循环 + generateObject + streamText
- [x] PlanSearches: `generateObject({ schema: planSearchSchema })` 生成 2-4 查询
- [x] AnalyzeResults: `generateObject({ schema: analysisSchema })` 返回 coverage+need_more
- [x] GenerateReport: `streamText` 流式生成 markdown 报告（CANCELLED 不写）
- [x] while 循环条件: `need_more AND iter < maxIterations AND !signal.aborted`
- [x] 验证: `bun test test/research/agent.test.ts`（5 tests: dedup + query processing）

## 2. WaitForApproval + HITL ⚠️（使用 DB polling 兼容现有前端）

- [x] `features/research/agent.ts`: waitForApproval DB polling（500ms/10min 超时 auto-approve）
- [x] approve/skip/finish/cancel 路由操作 DB status
- [x] **不需要 DB 锁**（单用户桌面应用）

## 3. ExecuteSearches ✅

- [x] webSearch 并发 cap 3（Semaphore）
- [x] 结果去重：URL 规范化 normalization + 去重
- [x] 写 researchSession.aggregatedResults

## 4. SSE 流 ✅

- [x] GET /research/:id/stream — poll-based SSE（1s 轮询）
- [x] 事件映射：plan→plan_ready, search→search_progress, analyze→analysis, done

## 5. Cancel 真中断 ✅

- [x] activeResearch 管理 Map<number, AbortController>
- [x] cancel 路由: AbortController.abort() → runResearch 自然终止
- [x] 不需要 DB 锁

## 6. 路由 ✅

- [x] router.ts 使用 AbortController
- [x] /cancel/resume/approve/export 全部移植

## 7. 整体验证


## Verification

```bash
cd apps/server
bun test test/research/   # agent/hitl/execute/sse/cancel
bun test tests/bdd/       # research BDD
bun oxlint apps/server/src/features/research/
```
