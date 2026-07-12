# c53-fix-v2-sources-citations-contract — Design

## 关键决策

### D1: citations /context 路径修正（BREAKING）

路径从 `/v2/citations/context?notebook_id=` 改回 `/v2/notebooks/:nid/citations/context`（对齐 v1 `api.py:13` 与 c26 proposal/design 承诺）。notebook_id 从 query param 改为 path param。**需同步前端 apps/web 调用路径**。这是 c26 实现违反自身 design 的修正。

### D2: citations 默认 before/after=1

`router.ts:89-90` 默认从 2 改 1（对齐 v1 `api.py:61-62`）。clamp 0-5 保留。

### D3: qa-to-source 多轮

`source-extras.router.ts:228-231` 接受 `messages: QAMessage[]`（对齐 v1 api_qa.py）。格式化完整 transcript（含角色标签）。保留单轮 {question, answer} 作为便捷形式（或 schema 二选一）。

### D4: tag 绑定 per-item 诊断

批量 assign/remove 返回 `results: SourceBatchItemResult[]`（{source_id, ok, message, error_code}，对齐 v1）。缺失 source 报 SOURCE_NOT_FOUND 而非静默 continue。保留 {applied, skipped} 计数为便捷汇总。

### D5: CSV 转义

`parsers/csv.ts` 转义 `|`→`\|`、换行转义、截断用 `…`（对齐 v1 `csv.py:61-67`）。

### D6: connector config 校验

每个 built-in connector 声明 connection_config 的 Zod schema（对齐 v1 plugins.connection_config_schema 的 JSON schema）；创建 binding 时校验，非法 → 400。

## 迁移与回滚

- **BREAKING**: citations /context 路径修正 → 需前端配合（apps/web 同步更新）。
- 其余为行为修正或新增字段，向后兼容。
- 回滚 = git revert（含前端回滚）。
