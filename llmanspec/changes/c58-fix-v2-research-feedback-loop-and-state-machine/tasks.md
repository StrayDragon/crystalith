# c58 Tasks

## 1. P1-A: suggested_queries 反馈环

- [ ] 1.1 `agent.ts`: analyze 后把 `analysis.suggestedQueries` 存入 state/闭包（如 `state.lastSuggestedQueries`）
- [ ] 1.2 `agent.ts`: `planSearches` prompt 构建：若 `state.lastSuggestedQueries` 非空，追加 "Suggested focus areas (from previous analysis):" 段落
- [ ] 1.3 确保第 1 轮（无 prior analysis）不报错

## 2. P1-B: 锁续期周期性

- [ ] 2.1 `agent.ts`: `runResearch` 函数开头启动 `setInterval(() => renewLock(sessionId), 300_000)`（300s）
- [ ] 2.2 用 try/finally 包裹循环体，finally 内 `clearInterval`
- [ ] 2.3 确认 cancel/异常/正常退出三条路径都触发 finally

## 3. P1-C: finish fallback 不写哨兵

- [ ] 3.1 `router.ts`: `generateFinalReport` catch 块：若 `aggregatedResults.length > 0`，合成 markdown（"## 研究结果摘要" + 结果列表 title/url/snippet 截断）
- [ ] 3.2 若 `aggregatedResults` 为空，写 "（研究未收集到结果，请尝试调整搜索关键词）" 而非 `'(report generation failed)'`
- [ ] 3.3 确认 `/export` 的 `if (!row.finalReport)` 守卫不会被非空 fallback 字符串误导

## 4. P1-D: stream auto-resume

- [ ] 4.1 `router.ts`: `/research/:id/stream` handler 开头检测 `_shouldResumeResearch`（status active 且锁未持有）
- [ ] 4.2 若需 resume，调 `spawnResearch(session.id, runResearchFromState)`
- [ ] 4.3 复用现有 `inferResumeState` 判断逻辑

## 5. P1-E: skip→analyze

- [ ] 5.1 `agent.ts`: skip 分支改为先调 `analyzeResults(topic, state.results, iteration)`，存 `state.lastAnalysis`
- [ ] 5.2 然后 `continue`（下一轮 plan 能读到 lastAnalysis.suggestedQueries，与 D1 联动）

## 6. 测试

- [ ] 6.1 `test/research/feedback-loop.test.ts`: 第 2 轮 plan prompt 包含第 1 轮 analyze 的 suggested_queries
- [ ] 6.2 `test/research/lock-renewal.test.ts`: 模拟长时间运行，锁 TTL 在 10min 后仍有效
- [ ] 6.3 `test/research/finish-fallback.test.ts`: LLM 失败时 finalReport 含结果摘要（非哨兵）
- [ ] 6.4 `test/research/stream-auto-resume.test.ts`: stalled 会话 GET stream 触发 resume
- [ ] 6.5 `test/research/skip-analyze.test.ts`: skip 后 analyze step 被记录

## 7. spec + 验证

- [ ] 7.1 `llman sdd validate c58-fix-v2-research-feedback-loop-and-state-machine` 通过
- [ ] 7.2 `bun test` (server) 通过
- [ ] 7.3 `bun typecheck` (server) ✅
- [ ] 7.4 `bun oxlint` 0 error
