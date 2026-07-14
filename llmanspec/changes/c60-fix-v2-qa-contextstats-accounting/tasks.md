# c60 Tasks

## 1. P1-A: system_tokens 真实计数

- [x] 1.1 `retrieve-and-judge.ts`: import `getContextWindowSettings`；新增 `systemPrompt?` option
- [x] 1.2 `systemTokens = opts.systemPrompt ? countTokens(opts.systemPrompt) : 0`
- [x] 1.3 两处 ContextStats 构建（empty + evidence）都改 system_tokens + total_tokens
- [x] 1.4 retrievalBudget 减去 systemTokens
- [x] 1.5 handler.ts 两处 retrieveAndJudge 调用传 systemPrompt

## 2. P1-B: max_tokens 读配置

- [x] 2.1 `maxTokens = opts.maxTokens ?? getContextWindowSettings().max_tokens`
- [x] 2.2 保留 opts.maxTokens 覆盖 + config fallback（默认 8000 在 schema 内）

## 3. 测试

- [x] 3.1 `test/qa/c60-contextstats.test.ts`: system_tokens 非零 + 缺省 0 + 随长度增长 + total 含 system (4 tests)

## 4. spec + 验证

- [x] 4.1 `llman sdd validate c60-fix-v2-qa-contextstats-accounting` 通过
- [x] 4.2 `bun test` (server) 通过（275 pass / 0 fail）
- [x] 4.3 `bun typecheck` (server) ✅
- [ ] 4.4 `bun oxlint` 0 error
