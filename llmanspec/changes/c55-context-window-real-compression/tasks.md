# Tasks — c55-context-window-real-compression

## 1. 截断工具

- [x] 1.1 `apps/server/src/ai/tokenizer.ts` 已有 `truncateToTokens`（单块 head 截断），复用之
- [x] 1.2 在 `apps/server/src/rag/context-window.ts` 新增 `truncateToTokenBudget(blocks, budgetTokens)`（移植 v1 `_truncate_blocks`，block 顺序累加 + 边界块部分裁剪 + joiner token 计入预算）
- [x] 1.3 单元测试 `apps/server/test/rag/context-window.test.ts`：超预算截断 / 预算内透传 / 边界块部分裁剪 / budget≤0 空输出（4 新测试全过）

## 2. QA 路径接入

- [x] 2.1 `apps/server/src/features/qa/retrieve-and-judge.ts`：保留 contextBlocks 数组（不再提前 join）；Step 12 算出 retrievalBudget = max_tokens - history - query，超预算时调用 `truncateToTokenBudget`
- [x] 2.2 `compressed` 标志现在反映实际是否截断（truncated）；`retrieval_tokens` 反映截断后 token 数
- [x] 2.3 qa handler 测试回归通过（9/9）

## 3. outputs/refine 路径审查

- [x] 3.1 `outputs/pipeline.ts`：context 由 topK-bounded RAG 限制，无 maxTokens 预算字段、无 compressed 标志（v1 output_graph 也是消费 retrieved.stats.truncated，截断发生在 shared retrieval；outputs 本身不另设预算）。与 v1 一致，无需改动
- [x] 3.2 `refine/retrieve.ts`：同上，topK-bounded + v1 refine worker 无 budget/truncate 逻辑。与 v1 一致，无需改动
- [x] 3.3 结论：QA 是唯一带 maxTokens 预算 + compressed 标志的路径（spec r2/r9 的主要违反点），已修复；outputs/refine 用 topK 限制不溢出，对齐 v1

## 4. 验证

- [x] 4.1 `cd apps/server && bun test`（218 pass / 1 fail——research 网络 timeout 非回归，隔离通过）
- [x] 4.2 `cd apps/server && bun run typecheck` ✅
- [x] 4.3 `bun oxlint`（0 error）✅
- [x] 4.4 `llman sdd validate c55-context-window-real-compression --strict --no-interactive`（结构无错）
- [x] 4.5 truncateToTokenBudget 单测保证：超 budget → truncated=true + usedTokens ≤ budget；QA Step 12 用该返回值驱动 context + compressed + retrieval_tokens
