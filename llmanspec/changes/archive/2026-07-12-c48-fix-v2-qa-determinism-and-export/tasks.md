# fix-v2-qa-determinism-and-export — Tasks

## 1. QA 检索改确定性单 embed (P1)

- [x] `features/qa/retrieve-and-judge.ts`: 移除 `multiQuery: true`（显式 `multiQuery: false`），对齐 v1 单次 embed 路径
- [x] 验证同一 (question, source_ids, embedding) 两次检索产出一致（确定性路径）
- [x] 验证 score 与 v1 raw cosine 可比（非 RRF 归一化）

## 2. stats preset (P1)

- [x] `features/qa/presets.ts`: 新增 `stats` preset（STATS_SYSTEM_PROMPT verbatim 移植 v1 presets.py:59-66）+ StatsChart/StatsTable/StatsPresetOutput 类型 + `parseStatsPresetOutput`（对齐 v1 presets.py:67-83）
- [x] `features/qa/handler.ts`: 线程化 `preset` 到 QaHandlerOptions；generateQaDirect 在 preset=stats 时生成→parse→用 fallback_markdown 作答；streamQa 加 stats 分支（生成→parse→流式 240-char chunks，对齐 v1 api.py:457-504）
- [x] `features/qa/router.ts`: 两个 handler 调用点（非流式+流式）传 `preset`
- [x] `resolvePreset`: stats preset 不插 directive 占位符（固定指令）

## 3. ContextStats 真实 token + compressed (P1)

- [x] `features/qa/retrieve-and-judge.ts`: 引入 `countTokens`（gpt-tokenizer，复用 ai/tokenizer.ts），替换 emptyStats 与 evidence 门的字符估算
- [x] 实现压缩标记：`compressed = totalTokens > maxTokens`（对齐 v1 ContextWindow 行为）
- [x] `features/qa/handler.ts`: estimateTokens 改用 countTokens

## 4. Export markdown citation 行补 page/para (P1)

- [x] `features/qa/router.ts`: citation 行对齐 v1 `_format_citation_line`（api.py:599-610）：`[i] name · chunk N · page N · para N` + blockquote snippet
- [x] 补 `- Notebook ID:` 行（v1 api.py:698）

## 5. Export JSON sources meta 对齐 (P1)

- [x] `features/qa/router.ts`: sources meta 改为 `{source_id, source_name, mime_type, parser_type}`（对齐 v1 QAExportSource, api.py:89-94）
- [x] notebook-scoped 查询（join session→notebookId，按 sources.notebookId 过滤，对齐 v1 api.py:669）
- [x] 补 cited-but-deleted 的 fallback 条目（对齐 v1 api.py:584-595）
- [x] JSON 顶层补 `notebook_id`（v1 api.py:679）

## Verification

```bash
cd apps/server && bun typecheck   # ✅ pass
cd apps/server && bun test        # ✅ 209 pass / 2 fail（research 网络 + URL 超时，非回归，与基线一致）
cd apps/server && bun test test/qa/ # ✅ 13 pass / 0 fail
```

人工：

- 同一输入两次 QA 检索结果一致（multiQuery:false）
- preset=stats 产出 StatsChart/StatsTable JSON（fallback_markdown 作答）
- 历史超限时 ContextStats.compressed=true
- 导出 markdown citation 行含 page/para + Notebook ID 行
- 导出 JSON sources 含 mime_type/parser_type + notebook_id + fallback 条目
