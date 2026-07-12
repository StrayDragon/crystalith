# c50-fix-v2-outputs-slides-guard-validation — Design

## 关键决策

### D1: SLIDES 400 守卫（而非加 postprocess case）

PROGRESS.v2.md 把 "SLIDES 缺 postprocess case" 当作 postprocess 债务，但 v1 `api.py:205-206` 根本不让 SLIDES 进 outputs pipeline——SLIDES 走独立 studio 特性。正确修复是 outputs 端点对 type=SLIDES 返回 400，而非给 pipeline 加 SLIDES case。这是契约对齐，不是补 case。

### D2: source_id 校验

pipeline 入口加 `validateSourceIds(notebookId, sourceIds)`：查 DB 确认每个 id 属于 notebook，未知 id 抛 400（对齐 v1 `_validate_source_ids`）。在 retrieveWith 之前调用。

### D3: citation sanitize

实现 `sanitizeCitationsIndices(content, maxCitationIndex)`：递归遍历 content，对每个 citations 数组剥离越界（>max）/重复/非整数索引；设 `_postprocessed:true` 与 `_warnings`（对齐 v1 `output_postprocess.py:293-346,377`）。在 mapCitationsIntoContent 之后调用。

### D4: LLM repair loop（preference=quality）

实现 `needsRepair(content)` 检测空/缺关键字段（对齐 v1 `output_postprocess.py:192-290`）；preference=quality 且 needsRepair=true 时跑第二次 generateObject pass 尝试修补（对齐 v1 `output_graph.py:595-719`）。repair 仍失败则降级 fallback。

## 迁移与回滚

- 无 DB schema 变更；SLIDES 400 是契约对齐（v1 一直 400）。
- 回滚 = git revert。
