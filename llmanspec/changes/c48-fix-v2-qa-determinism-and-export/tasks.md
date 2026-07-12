# fix-v2-qa-determinism-and-export — Tasks

## 1. QA 检索改确定性单 embed (P1)

- [ ] `features/qa/retrieve-and-judge.ts:139`: 移除 `multiQuery: true`（显式 `multiQuery: false` 或不传），对齐 v1 单次 embed 路径
- [ ] 验证同一 (question, source_ids, embedding) 两次检索产出一致
- [ ] 验证 score 与 v1 raw cosine 可比（非 RRF 归一化）

## 2. stats preset (P1)

- [ ] `features/qa/presets.ts`: 新增 `stats` preset（STATS_SYSTEM_PROMPT + StatsChart/StatsTable schema），对齐 v1 `presets.py:33-99`
- [ ] `features/qa/handler.ts` 或 router: stats preset 的专用生成 + JSON 解析路径（对齐 v1 `api.py:289-304,457-504` 的 `parse_stats_preset_output`）

## 3. ContextStats 真实 token + compressed (P1)

- [ ] 引入 gpt-tokenizer（已是依赖）做真实 token 计数，替换 `retrieve-and-judge.ts:118,244-252` 与 `handler.ts:179-181` 的字符估算
- [ ] 实现历史超限压缩 → `compressed=true`（对齐 v1 `service.py:254-271` 的 ContextWindow）
- [ ] `system_tokens` 用真实 system prompt token 数（非硬编码 0）

## 4. Export markdown citation 行补 page/para (P1)

- [ ] `features/qa/router.ts:391-398`: citation 行对齐 v1 `_format_citation_line`（`[i] name · chunk N · page N · para N` + blockquote snippet）
- [ ] 补 `- Notebook ID:` 行（v1 `api.py:698`）

## 5. Export JSON sources meta 对齐 (P1)

- [ ] `features/qa/router.ts:370-374`: sources meta 改为 `{source_id, source_name, mime_type, parser_type}`（对齐 v1 `api.py:89-94`）
- [ ] notebook-scoped 查询（v1 `api.py:669` 过滤 notebook_id）
- [ ] 补 cited-but-deleted 的 fallback 条目（v1 `api.py:584-595`）
- [ ] JSON 顶层补 `notebook_id`（v1 `api.py:679`）

## Verification

```bash
cd apps/server && bun typecheck   # MUST pass
cd apps/server && bun test        # QA 相关测试 MUST pass，无回归
```

人工：

- 同一输入两次 QA 检索结果一致；score 与 v1 可比
- preset=stats 产出 StatsChart/StatsTable JSON
- 历史超限时 ContextStats.compressed=true
- 导出 markdown/json 与 v1 逐行对齐
