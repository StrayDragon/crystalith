# c48-fix-v2-qa-determinism-and-export — Design

## 关键决策

### D1: QA 检索去 multiQuery（确定性）

`retrieve-and-judge.ts:139` 的 `multiQuery: true` 改为不传或显式 `false`。RAG 的 embed-strategy 仍支持 multiQuery 供 outputs/research 等域用，仅 QA 路径走确定性单 embed（与 v1 `service.py:319-327` 一致）。

### D2: stats preset 新增

在 `presets.ts` 加 `stats`（STATS_SYSTEM_PROMPT + StatsChart/StatsTable schema），复用现有 preset dispatch 机制。生成路径走 generateObject + 专用 JSON 解析（对齐 v1 `parse_stats_preset_output`）。

### D3: ContextStats 真实 token

用 gpt-tokenizer（已是依赖，c02 引入）替换字符估算。历史压缩：累积 history_tokens 超过 max_tokens 的比例阈值时触发截断/摘要，置 `compressed=true`（对齐 v1 ContextWindow 行为）。

### D4: export 对齐

逐项对齐 v1：citation 行加 page/para；JSON sources 改 {source_id, source_name, mime_type, parser_type} + notebook scope + cited-but-deleted fallback；补 notebook_id 顶层字段与 markdown `- Notebook ID:` 行。

## 迁移与回滚

- 纯行为修正，无 DB schema 变更、无 API 路径变更。
- 回滚 = git revert。
