# c58 Tasks

## 1. P1-A: suggested_queries 反馈环

- [x] 1.1 `agent.ts`: ResearchState 加 `lastAnalysis?: AnalysisResult | null`
- [x] 1.2 `agent.ts`: `buildPlanPrompt(state)` — 若 `state.lastAnalysis.suggestedQueries` 非空，追加 "Suggested focus areas (from previous analysis):" 段落
- [x] 1.3 确保第 1 轮（无 prior analysis）不报错（lastAnalysis 默认 undefined，条件跳过）

## 2. P1-B: 锁续期周期性

- [x] 2.1 `agent.ts`: `runResearchCore` 开头启动 `setInterval(() => renewLock(sessionId), 300_000)`（300s）
- [x] 2.2 用 try/finally 包裹循环体，finally 内 `clearInterval(lockHeartbeat)`
- [x] 2.3 确认 cancel/异常/正常退出三条路径都触发 finally（try/finally 保证）

## 3. P1-C: finish fallback 不写哨兵

- [x] 3.1 `agent.ts`: 新增 `synthesizeFallbackReport(topic, results)` — 若有结果合成摘要，空则写 "（研究未收集到结果…）"
- [x] 3.2 `router.ts`: finish catch 块改用 `synthesizeFallbackReport(row.topic, results)` 替代 `'(report generation failed)'`
- [x] 3.3 确认 `/export` 的 `if (!finalReport)` 守卫不会被非空 fallback 字符串误导（fallback 总是非空有意义内容）

## 4. P1-D: stream auto-resume

- [x] 4.1 `router.ts`: `/research/:id/stream` handler 开头检测 active status 且 `!activeResearch.has(id)`
- [x] 4.2 若需 resume，调 `spawnResearch(id, runResearchFromState)`
- [x] 4.3 复用现有 `spawnResearch` + `runResearchFromState`

## 5. P1-E: skip→analyze

- [x] 5.1 `agent.ts`: skip 分支改为先调 `analyzeResults(state, signal)`，存 `state.lastAnalysis`（含 catch fallback）
- [x] 5.2 然后 `continue`（下一轮 plan 能读到 lastAnalysis.suggestedQueries，与 D1 联动）

## 6. 测试

- [x] 6.1 `test/research/c58-feedback-fallback.test.ts`: synthesizeFallbackReport 4 场景（空结果/有结果/20截断/snippet截断）

## 7. spec + 验证

- [x] 7.1 `llman sdd validate c58-fix-v2-research-feedback-loop-and-state-machine` 通过
- [x] 7.2 `bun test` (server) 通过（261 pass / 0 fail）
- [x] 7.3 `bun typecheck` (server) ✅
- [ ] 7.4 `bun oxlint` 0 error
