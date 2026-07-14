# c60 Tasks

## 1. P1-A: system_tokens 真实计数

- [ ] 1.1 `retrieve-and-judge.ts`: `system_tokens = countTokens(systemPrompt)`（import 自 ai/tokenizer.ts）
- [ ] 1.2 两处 ContextStats 构建（stream + direct 路径）都改

## 2. P1-B: max_tokens 读配置

- [ ] 2.1 `retrieve-and-judge.ts`: `maxTokens = config().contextWindow?.maxTokens ?? 8000`
- [ ] 2.2 保留 8000 作为 fallback

## 3. 测试

- [ ] 3.1 `test/qa/contextstats-system-tokens.test.ts`: system_tokens 非零
- [ ] 3.2 `test/qa/contextstats-max-tokens-config.test.ts`: config 改 max_tokens 后反映

## 4. spec + 验证

- [ ] 4.1 `llman sdd validate c60-fix-v2-qa-contextstats-accounting` 通过
- [ ] 4.2 `bun test` (server) 通过
- [ ] 4.3 `bun typecheck` (server) ✅
- [ ] 4.4 `bun oxlint` 0 error
