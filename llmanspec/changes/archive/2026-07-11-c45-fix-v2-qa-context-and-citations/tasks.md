# fix-v2-qa-context-and-citations — Tasks

## 1. ContextStats 字段对齐

- [x] `features/qa/retrieve-and-judge.ts`: 字段改为 total_tokens/system_tokens/history_tokens/retrieval_tokens/query_tokens/max_tokens/compressed
- [x] `ai/stream.ts`: contextStats 类型同步
- [x] `features/qa/handler.ts`: done 事件 context 用新字段名

## 2. _ensure_inline_citations 兜底

- [x] `features/qa/handler.ts`: 实现 ensureInlineCitations(answer, citations) — 无 [...] 时追加 [1]
- [x] 在 streamQa onMessageSettled 中应用

## 3. low_similarity 空 citations

- [x] `features/qa/retrieve-and-judge.ts`: low_similarity 时传 citations=[] 而非实际 citations

## 4. /prompt: 指令解析

- [x] `features/qa/router.ts`: parsePromptDirective 从 question 解析 /^\/prompt:(\w+)\s+/
- [x] POST /qa + POST /qa/stream 都应用

## 5. refine chunk_index 决策文档化

- [x] 统一 1-based（已在 996e2a88 修复），design.md 记录决策

## Verification

```bash
cd apps/server && bun typecheck  # ✅ pass
cd apps/server && bun test       # ✅ 209 pass / 2 fail (network timeout, no regression)
```

## 未做（P1 但依赖较多，可后置）

- stats preset（chart+table JSON）：需新 schema + 专用 generateObject 路径，影响面大，留后续
- context window 压缩：需实现 ContextWindow 类 + 压缩逻辑，留后续
