---
depends_on: []
batch: all
---

# c48-fix-v2-qa-determinism-and-export — QA 确定性检索 + stats preset + ContextStats 真实 token + export 对齐

## Why

2026-07-12 第四轮深度复核发现 QA 域存在 **5 个 P1**（c36/c45 标 DONE 但部分承诺未兑现，c45 tasks.md 自陈 deferral）。

### P1-1 — 确定性检索承诺未兑现（c36 核心承诺）

- **c36 proposal** 标题即为"确定性检索前置阶段"，但 v2 `retrieve-and-judge.ts:139` 硬编码 `multiQuery: true`，会经 `embed-strategy.ts:104-109` → `multi-query.ts:26-36` 做 seed 扩张 + RRF fusion。
- **v1** (`service.py:319-327`): 单次 `embed_batch([question])` + 单次 `cached_vector_search`，无 query expansion、无 fusion，完全确定性。
- **后果**: v2 的 score 是 RRF-rank 归一化值，非 v1 的 raw cosine；`low_similarity` 门控与 confidence 计算的输入与 v1 不可比。当前因 QA 路径不传 outputType，seed 只生成 1 个，divergence 是**潜伏的**——一旦 outputType 被透传就会显现。

### P1-2 — stats preset 完全缺失

- **v1** (`presets.py:93-99`, `api.py:289-304,457-504`): 有 `stats` preset，含 `STATS_SYSTEM_PROMPT` + `StatsChart`/`StatsTable` schema + 专用生成 + JSON 解析路径。
- **v2** (`presets.ts`): 只有 `default/analysis/creative/explainer`，无 `stats`。c45 tasks.md:34-36 自陈 deferral。

### P1-3 — ContextStats 用字符估算 + compressed 永远 false

- **v1** (`service.py:254-271`): 用真实 `TokenCounter` + `ContextWindow`，历史超限时 `compressed=true`。
- **v2** (`retrieve-and-judge.ts:118,244-252`, `handler.ts:179-181`): 用 `Math.ceil(length/4)` 字符估算；`system_tokens: 0`、`compressed: false` 硬编码。c45 tasks.md:37 自陈 deferral。任何按 `compressed===true` 门控的消费方在 v2 永不触发。

### P1-4 — Export markdown citation 行缺 page/para

- **v1** (`api.py:599-610` `_format_citation_line`): `[i] name · chunk N · page N · para N` + blockquote snippet。
- **v2** (`router.ts:391-398`): 仅 `[i] name · chunk N` + snippet。丢失 page_number/paragraph_index。

### P1-5 — Export JSON sources meta 形状不一致

- **v1** (`api.py:89-94,584-595,669`): `{source_id, source_name, mime_type, parser_type}`，notebook-scoped，含 cited-but-deleted 的 fallback 条目；顶层有 `notebook_id`。
- **v2** (`router.ts:370-374,379-387`): `{id, filename, status}`，不按 notebook scope，无 fallback，无顶层 `notebook_id`，markdown 缺 `- Notebook ID:` 行。

## What Changes

1. **QA 检索改确定性单 embed**: `retrieve-and-judge.ts:139` 移除 `multiQuery: true`（或显式传 `multiQuery: false`），与 v1 单次 embed 路径对齐。
2. **stats preset**: 在 `presets.ts` 加 `stats`（STATS_SYSTEM_PROMPT + StatsChart/StatsTable schema + 解析路径），对齐 v1 `presets.py:33-99`。
3. **ContextStats 真实 token**: 引入 token 计数（gpt-tokenizer 已是依赖），实现历史压缩 → `compressed=true`，对齐 v1 `service.py:254-271`。
4. **Export citation 行补 page/para**: `router.ts:391-398` 对齐 v1 `_format_citation_line`。
5. **Export JSON sources meta 对齐**: `{source_id, source_name, mime_type, parser_type}` + notebook-scoped + cited-but-deleted fallback + 顶层 `notebook_id`；markdown 补 `- Notebook ID:` 行。

## Capabilities

- `retrieval-and-cache`（spec delta: QA 确定性单 embed 检索）
- `generation-presets-and-constraints`（spec delta: stats preset + ContextStats 真实 token + export 对齐）

## Impact

- **检索回归确定性**: 同一输入两次 QA 检索结果一致；score 与 v1 可比。
- **stats preset 可用**: 客户端能用 preset=stats 得到结构化图表/表格。
- **ContextStats 可信**: 前端可据 compressed 门控压缩提示。
- **export 一致**: markdown/json 与 v1 逐行对齐，跨版本 diff 无噪音。
- **无 BREAKING**: 端点路径不变；响应字段为新增或数值修正。
