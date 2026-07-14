# c60 Design — QA ContextStats 计量修正

> SSOT: `backend/py/src/crystalith/features/qa/service.py:254-271` + `shared/context.py`

## 决策

### D1: system_tokens 用 countTokens(systemPrompt)

v2 已有 `ai/tokenizer.ts` 的 `countTokens(text: string): number`（gpt-tokenizer cl100k_base）。`retrieve-and-judge.ts` 在构建 ContextStats 时，`system_tokens = countTokens(systemPrompt)`。systemPrompt 变量在 handler.ts:138 已构建（`${opts.systemPrompt}\n\nSource material:...`），需传入或重建。

注意：v1 的 system_tokens 只计 system prompt 本身（不含 Source material 拼接），还是含拼接后的完整 system 内容？对照 v1 ContextWindow.build —— system_tokens 计的是 system message 的 token 数。v2 的 systemPrompt 变量若已含 Source material 拼接，则 countTokens 计的是拼接后总量，对齐 v1 语义。

### D2: max_tokens 从 config 读取

v2 `shared/config.ts` 解析了 `context_window` 段落（c55 确认）。`maxTokens` 从 `config().contextWindow?.maxTokens ?? 8000` 读取。保留 8000 fallback。

## 涉及文件

### 修改

- `apps/server/src/features/qa/retrieve-and-judge.ts` —— system_tokens = countTokens(systemPrompt)；maxTokens 从 config 读

### 新增测试

- `apps/server/test/qa/contextstats-system-tokens.test.ts` —— system_tokens 非零且随 system prompt 长度变化
- `apps/server/test/qa/contextstats-max-tokens-config.test.ts` —— 修改 config max_tokens 后 ContextStats 反映新值
