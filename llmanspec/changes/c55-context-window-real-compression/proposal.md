---
depends_on: []
batch: all
---

# c55-context-window-real-compression — context window 超预算时真实截断（非仅标志）

## Why

2026-07-13 代码审计发现检索上下文压缩是**伪对齐**：`retrieval-and-cache` spec 的 r2/r9 + scenario r2 明确要求"检索上下文 MUST 受 token budget 约束，超预算时 MUST 截断或压缩"，但 v2 实现只算 `compressed` 标志、**从不执行截断**。

### Spec 已要求（MUST）

- `retrieval-and-cache r2` —— "检索上下文 MUST 受 token budget 约束，超预算时 MUST 截断或压缩"
- `retrieval-and-cache r9` —— "检索上下文组装 MUST 受 token budget 约束，超预算时按优先级截断（history→retrieval→recent→system→query）。token 计数 MUST 使用 gpt-tokenizer。MUST NOT 用字符数截断替代 token 截断"
- scenario `r2 context-truncates-when-over-budget` —— "组装的检索上下文超过 token budget → 系统 SHALL 截断或压缩上下文"

### 实现违反

`apps/server/src/features/qa/retrieve-and-judge.ts:245-265`（c48 引入）：

```ts
const compressed = totalTokens > maxTokens; // 仅算标志
return { /* ... */ context, /* 原样透传，未截断 */ contextStats: { compressed } };
```

`context` 字段从未被截断，即使 `compressed === true`。大 notebook 上会触发 LLM context-window 溢出。

### v1 参考（正确行为）

`backend/py/src/crystalith/shared/retrieval/context.py:438-485` 的 `_truncate_blocks`：

- 按 block 顺序累加 token；
- 超 budget 时对边界 block 做 `truncate_text(block, remaining)` 部分裁剪；
- 返回 `(kept_blocks, truncated_flag, used_tokens)`。

## What Changes

1. 新增 `truncateToTokenBudget(blocks, budgetTokens)` 工具（移植 v1 `_truncate_blocks`），放 `apps/server/src/rag/` 或 `shared/`。
2. `retrieve-and-judge.ts` 在算出 `compressed` 后，对 `context` 实际执行截断，使透传给 LLM 的文本 ≤ max_tokens。
3. 同步审查 `outputs/pipeline.ts` 与 `refine/retrieve.ts` 的 context 组装路径，若同样无截断则一并接入（确保 3 条生成路径一致，对齐 r1 "outputs 与 slides MUST 复用同一检索策略族"）。
4. 单元测试：超预算截断、预算内透传、边界 block 部分裁剪。

## Capabilities

- `retrieval-and-cache` —— 新增 1 requirement（超预算时 MUST 真实截断，非仅标志）

## Impact

- **用户可见改进**：大 notebook 不再触发 LLM context-window 溢出错误；`compressed` 标志与实际行为一致。
- **代码量**：+1 工具函数（~30 行）+ 3 处调用点接入。
- **风险**：低-中。截断改变 LLM 输入，可能微调生成质量（通常更好，因为不再溢出）。需回归 QA/outputs/refine 测试。
- **依赖**：与 c54 独立（c54 改 ContextStats 类型定义位置，c55 用该类型的 `compressed` 字段驱动真实截断；两者可并行，c55 不阻塞 c54）。
