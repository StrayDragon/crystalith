---
depends_on: [c36-align-v2-qa-pipeline]
batch: all
---

# c45-fix-v2-qa-context-and-citations — QA ContextStats 契约 + citation 兜底 + presets

## Why

c36 标 DONE，但 2026-07-11 第三轮复核发现 QA 的 ContextStats 线上格式与 v1 不兼容，且多处 citation/preset 行为偏离。存在 1 个 P0 + 6 个 P1：

- **ContextStats 字段名不兼容** [P0]: v1 `context/types.py:11-18` 用 `total_tokens`/`system_tokens`/`history_tokens`/`retrieval_tokens`/`query_tokens`/`max_tokens`/`compressed`。v2 `retrieve-and-judge.ts:65-72` 用 `total`/`system`/...（无 `_tokens` 后缀）且**丢掉 `compressed`**。消费 v1 字段名的客户端拿到 `undefined`。
- **缺 `_ensure_inline_citations` 兜底** [P1]: v1 `api.py:107-112` 在 answer 无 `[...]` 时追加 `[1]`。v2 无等价逻辑。
- **low_similarity 返回 citations** [P1]: v1 `service.py:455-464` 在 low_similarity 时返回 `citations=[]`。v2 `retrieve-and-judge.ts:223` 仍传入 citations。
- **/prompt: 指令未解析** [P1]: v1 `presets.py:9-30` 从 question 文本解析 `/prompt:stats <query>`。v2 只接受 body `preset` 字段。
- **stats preset 缺失** [P1]: v1 `presets.py:33-99` 有 stats preset（chart+table JSON）。v2 无。
- **无 context window 压缩** [P1]: v1 `build_context_window`（`service.py:254-271`）有历史压缩 + `compressed=true`。v2 用 `length/4` 估算，无压缩。
- **refine chunk_index 0-vs-1 不一致** [P1]: v1 worker 单格式 0-based（`worker.py:240`），batch 1-based（`api.py:295`）。v2 统一 1-based。需明确决策对齐哪个（建议对齐 batch=1-based，因前端更直观）。

## What Changes

1. **ContextStats 字段对齐**: 改为 `total_tokens`/`system_tokens`/`history_tokens`/`retrieval_tokens`/`query_tokens`/`max_tokens`/`compressed`
2. **`_ensure_inline_citations` 兜底**: answer 无 `[...]` 时追加 `[1]`
3. **low_similarity 空 citations**: 对齐 v1 返回 `citations=[]`
4. **/prompt: 指令解析**: 从 question 文本解析 `/prompt:<preset>`
5. **stats preset**: 实现 chart+table JSON 生成（STATS_SYSTEM_PROMPT + StatsChart/StatsTable schema）
6. **context window 压缩**: 实现历史压缩 + `compressed` 标记
7. **refine chunk_index 决策**: 统一 1-based（已在未提交修复中），文档化决策

## Capabilities

- generation-core（spec delta: ContextStats 字段契约 + inline citation 兜底 + low_similarity 行为）
- chat-prompt-presets（spec delta: /prompt: 指令解析 + stats preset）
- evidence-review-workflow（spec delta: low_similarity citations 语义）

## Impact

- ContextStats 字段名变化（BREAKING v2 内部）：前端需适配 `_tokens` 后缀
- QA answer 在无 citation 时会追加 `[1]`
- low_similarity 时不再返回 citations
