# Design — c55-context-window-real-compression

## 决策

### D1. 截断算法：移植 v1 _truncate_blocks，不做摘要式压缩

**选择**：实现 `truncateToTokenBudget(blocks: string[], budgetTokens: number): { text: string; truncated: boolean; usedTokens: number }`，按 block 顺序累加，超 budget 时对边界 block 部分裁剪（`countTokens` + 字符回溯到 token 边界）。

**否决**：LLM 摘要式压缩（把超 budget 的内容总结成更短文本）。

- 理由：v1 用截断（确定性、无额外 LLM 调用、可复现）；摘要式压缩引入非确定性 + 额外 latency + 成本，且 v1 无此行为。保持 v1 parity。

### D2. 截断的优先级顺序

**选择**：对齐 v1 r9 的优先级 `history → retrieval → recent → system → query`。

- qa 路径：`query` 必须完整保留（用户问题不能截）；`retrieval`（context）按 block 顺序截断；qa 无 history/system 分块（qa 的 historyTokens 是会话历史，单独计算）。
- 实现上：只对 `context`（retrieval blocks）执行 `truncateToTokenBudget`，budget = `max_tokens - historyTokens - queryTokens`。这样 query + history 必然保留，retrieval 填剩余预算。

**否决**：对整个 prompt 字符串统一截断。

- 理由：会截到 query 或 history，破坏用户问题。分块截断更精确。

### D3. token 边界回溯

**选择**：v1 的 `truncate_text(block, remaining_tokens)` 用 tokenizer 的 decode(encode(block)[:remaining])。

- v2 用 `gpt-tokenizer`（c48 已引入 `countTokens`）：`truncateText(text, maxTokens)` = `decode(encode(text).slice(0, maxTokens))`。
- 确定性、与 v1 一致。

### D4. 放置位置：rag/ 还是 shared/

**选择**：`apps/server/src/rag/budget.ts`（与检索策略同目录，仅 server 端用）。

- **否决** shared/：截断依赖 tokenizer（`gpt-tokenizer`），shared 包不应带此依赖。

### D5. 三条生成路径的一致性

`outputs/pipeline.ts` 与 `refine/retrieve.ts` 也组装 context。审查：

- 若它们已有截断 → 仅确保用 token 计数（非字符数）；
- 若无 → 接入 `truncateToTokenBudget`，确保 r1（outputs/slides 复用同一检索策略族）的预算约束一致。
- qa 已有 `compressed` 标志，直接接入；outputs/refine 若无标志则补上（复用 c54 迁到 shared 的 ContextStats）。

## 验证策略

- 新增 `apps/server/test/rag/budget.test.ts`：
  - 超 budget → truncated=true，输出 token ≤ budget
  - 预算内 → truncated=false，原样
  - 边界 block 部分裁剪（不整块丢）
- qa 回归：`retrieve-and-judge` 在大 context 下返回的 `context` 实际 token 数 ≤ max_tokens。
- outputs/refine 回归：context 不溢出。
