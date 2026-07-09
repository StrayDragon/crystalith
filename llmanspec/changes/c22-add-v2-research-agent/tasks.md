# add-v2-research-agent — Tasks

## 1. 状态机核心

- [ ] 新建 `features/research/state-machine.ts`: runGraph 5 节点 async chain + AbortSignal
- [ ] PlanSearches: AI 生成 2-4 查询，写 researchStep(PLAN)
- [ ] AnalyzeResults: AI 返回 coverage+need_more，循环条件 need_more AND iter<max
- [ ] GenerateReport: AI markdown 报告（CANCELLED 不写）
- [ ] 验证: `bun test test/research/state-machine.test.ts`（多轮迭代、终止条件）

## 2. WaitForApproval + HITL

- [ ] WaitForApproval: DB 轮询 0.5s/10min，超时 auto-approve
- [ ] approve/modify/skip/finish/cancel/resume: 写 researchStep(USER_INPUT)
- [ ] 验证: `bun test test/research/hitl.test.ts`（各 action 状态转移）

## 3. ExecuteSearches

- [ ] webSearch 并发 cap 3（c19 Semaphore）
- [ ] 结果去重：URL 规范化（c18 canonicalizeUrlForDedup）+ 标题 Jaccard
- [ ] 写 researchSession.aggregatedResults
- [ ] 验证: `bun test test/research/execute.test.ts`（去重、并发）

## 4. DB-polling SSE

- [ ] 新建 `features/research/sse.ts`: GET /research/:id/stream，1s 轮询/30s heartbeat/3600 次
- [ ] 事件派生：plan_ready/thinking/search_progress/analysis/report/done
- [ ] 验证: `bun test test/research/sse.test.ts`（事件派生、heartbeat、terminal）

## 5. 锁管理 + cancel 真中断

- [ ] locked_at/lock_expires_at，LOCK_TIMEOUT=600s，_extend_lock 周期续期
- [ ] check_and_cleanup_expired_locks
- [ ] cancel: AbortController.abort()，runGraph 捕获设 CANCELLED
- [ ] 验证: `bun test test/research/lock.test.ts`（并发、过期清理、cancel 中断）

## 6. 路由/文档修复

- [ ] /stop vs /cancel 统一（注册 /cancel，更新 OpenAPI doc）
- [ ] 验证: 路由与文档一致

## 7. 整体验证

- [ ] `cd apps/server && bun test tests/bdd/`（research 域 BDD，需 LLM mock）
- [ ] `bun oxlint apps/server/src/features/research/`（0 error）

## Verification

```bash
cd apps/server
bun test tests/bdd/    # research 域（LLM mock）
bun test test/research/  # 状态机/HITL/SSE/锁
bun oxlint apps/server/src/features/research/
```
