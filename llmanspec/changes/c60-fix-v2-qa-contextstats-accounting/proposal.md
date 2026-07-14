---
depends_on: []
batch: all
---

# c60-fix-v2-qa-contextstats-accounting — QA ContextStats system_tokens 真实计算 + max_tokens 读配置

## Why

2026-07-13 第七轮深度审计发现 QA ContextStats 存在 2 个 P1。c48 已修复 retrieval token 计数（用 gpt-tokenizer），但 system prompt 的 token 成本和 context window 配置读取未对齐。

### 实现违反

1. **P1-A：ContextStats `system_tokens` 恒为 0**。v2 `retrieve-and-judge.ts:118,265` 硬编码 `system_tokens: 0`。v1 `service.py:261-271` 通过 `ContextWindow.build` + `TokenCounter` 计算真实 system prompt token 成本。v2 在 LLM 调用中注入了非平凡的 system prompt（`handler.ts:138` `${systemPrompt}\n\nSource material:...`），但 ContextStats 不计入。导致 `total_tokens` 低报，影响基于 ContextStats 做 budget 展示的消费者。
2. **P1-B：`max_tokens` 硬编码 8000**。v2 `retrieve-and-judge.ts:108` `opts.maxTokens ?? 8000`。v1 `service.py:265` 读 `settings.context_window.max_tokens`。v2 忽略配置的模型 context window，导致压缩预算和 `compressed` flag 对大/小窗口模型不正确。

### v1 参考（正确行为）

- `backend/py/.../qa/service.py:254-271` —— ContextStats 全字段真实计数（含 system_tokens）。
- `backend/py/.../shared/context.py` —— ContextWindow 读 `settings.context_window.max_tokens`。

## What Changes

1. **`apps/server/src/features/qa/retrieve-and-judge.ts`** —— `system_tokens` 改为 `countTokens(systemPrompt)`（用现有 `ai/tokenizer.ts` 的 `countTokens`），不再硬编码 0。
2. **`apps/server/src/features/qa/retrieve-and-judge.ts`** —— `maxTokens` 从 `getContextWindowConfig().maxTokens` 读取（或等价的 config 访问），fallback 保留 8000。
3. **测试** —— system_tokens 非零测试 + max_tokens 读配置测试。

## Capabilities

- `retrieval-and-cache` —— ADDED `qa-contextstats-system-tokens-must-be-real`（system_tokens MUST 真实计数）+ ADDED `qa-contextstats-max-tokens-must-read-config`（max_tokens MUST 读配置）

## Impact

- **无 BREAKING**（ContextStats 字段值修正，形状不变）。
- **用户可见改进**：ContextStats 的 total_tokens/system_tokens 准确；compressed flag 对不同模型窗口正确触发。
- **风险**：低。纯计量修正。
- **依赖**：独立于 c57–c59/c61–c62；不阻塞 c13/c14。
