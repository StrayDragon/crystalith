# fix-v2-qa-context-and-citations — Tasks

## 1. ContextStats 字段对齐

- [ ] `features/qa/retrieve-and-judge.ts:65-72`: 字段改为 total_tokens/system_tokens/history_tokens/retrieval_tokens/query_tokens/max_tokens/compressed
- [ ] `packages/shared` ContextStats schema 同步
- [ ] `features/qa/handler.ts`: done 事件 context 用新字段名

## 2. _ensure_inline_citations 兜底

- [ ] `features/qa/handler.ts` 或 `router.ts`: 实现 ensureInlineCitations(answer, citations) — 无 [...] 时追加 [1]

## 3. low_similarity 空 citations

- [ ] `features/qa/retrieve-and-judge.ts:223`: low_similarity 时传 citations=[] 而非实际 citations

## 4. /prompt: 指令解析

- [ ] `features/qa/router.ts`: 从 question 解析 /^\/prompt:(\w+)\s+/ 提取 preset

## 5. stats preset

- [ ] `features/qa/presets.ts`: 加 stats preset（STATS_SYSTEM_PROMPT）
- [ ] `packages/shared`: 加 StatsChart/StatsTable schema
- [ ] `features/qa/router.ts`: stats preset 走专用 generateObject 路径

## 6. context window 压缩

- [ ] `features/qa/retrieve-and-judge.ts`: 实现 context window 历史压缩 + compressed 标记

## 7. refine chunk_index 决策文档化

- [ ] 确认 refine chunk_index 统一 1-based（已在 996e2a88 修复）
- [ ] 在 design.md 或 PROGRESS 记录决策（对齐 v1 batch 路径 1-based，非 worker 0-based）

## Verification

```bash
cd apps/server && bun test features/qa features/refine
# ContextStats 字段为 total_tokens 等
# answer 无 [N] 时追加 [1]
# low_similarity 返回 citations=[]
# /prompt:stats 解析正确
```
