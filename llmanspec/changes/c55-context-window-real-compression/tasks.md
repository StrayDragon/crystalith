# Tasks — c55-context-window-real-compression

## 1. 截断工具

- [ ] 1.1 新建 `apps/server/src/rag/budget.ts`：实现 `truncateText(text, maxTokens)`（用 gpt-tokenizer encode→slice→decode）
- [ ] 1.2 实现 `truncateToTokenBudget(blocks, budgetTokens): { text, truncated, usedTokens }`（移植 v1 `_truncate_blocks`，block 顺序累加 + 边界块部分裁剪）
- [ ] 1.3 单元测试 `apps/server/test/rag/budget.test.ts`：超预算截断 / 预算内透传 / 边界块部分裁剪 / token 计数正确

## 2. QA 路径接入

- [ ] 2.1 `apps/server/src/features/qa/retrieve-and-judge.ts`：算出 `compressed` 后，对 `context` 执行 `truncateToTokenBudget`（budget = max_tokens - historyTokens - queryTokens），透传截断后的 text
- [ ] 2.2 确保 `compressed` 标志反映实际是否截断（与 truncated 一致）
- [ ] 2.3 qa handler 测试：大 context 场景下返回的 context 实际 token 数 ≤ max_tokens

## 3. outputs/refine 路径审查与接入

- [ ] 3.1 审查 `apps/server/src/features/outputs/pipeline.ts` 的 context 组装：是否已有截断？若无或用字符数，接入 `truncateToTokenBudget`
- [ ] 3.2 审查 `apps/server/src/features/refine/retrieve.ts` 的 context 组装：同上
- [ ] 3.3 确保三条路径（qa/outputs/refine）预算约束一致（对齐 r1）

## 4. 验证

- [ ] 4.1 `cd apps/server && bun test`（含新增 budget 测试 + qa/outputs/refine 回归）
- [ ] 4.2 `cd apps/server && bun run typecheck`
- [ ] 4.3 `bun oxlint`（0 error）
- [ ] 4.4 `llman sdd validate c55-context-window-real-compression --strict --no-interactive`
- [ ] 4.5 手动验证：构造超 max_tokens 的 context，断言 LLM 输入 ≤ max_tokens（可在 retrieveAndJudge 返回后断言 contextStats.retrieval_tokens ≤ max_tokens - history - query）
