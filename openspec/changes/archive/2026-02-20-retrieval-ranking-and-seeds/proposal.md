## Why

当前 multi-query retrieval 的结果合并策略偏保守（按 chunk 取最大 score 并排序），在真实数据上可能出现：

- 多查询结果被单一 query 的高分条目“支配”，覆盖面不稳定；
- 结果排序对“来自不同 query 的一致高排名”缺乏奖励，难以体现 multi-query 的集体信号；
- query seed 生成较通用，未充分利用 OutputType 的检索意图，导致额外 query 但收益不稳定。

## What Changes

- 引入更合理的 multi-query 合并/排序策略（例如 RRF / Borda / MMR），在保持去重/多来源多样性的同时，提高覆盖稳定性与抗噪声能力。
- 将 query seed 生成从“固定 2-3 条”演进为按 OutputType 的 seed/hint 体系（并保持可控上限，避免成本失控）。
- （可选）为“检索结果组装”增加短 TTL 缓存（高命中场景：同一 prompt/同一 source_ids 反复生成不同输出），减少重复 DB/format 开销。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `vector-storage`: multi-query 检索结果的合并与排序策略 MUST 可扩展且可测试，避免仅以最大 score 作为唯一合并信号。
- `rag-qa`: RAG 检索 SHOULD 能通过更稳健的排序/seed 策略提高 evidence 覆盖与一致性（不改变显式参数的优先级）。
- `backend-performance`: 在 multi-query 场景下，系统 SHOULD 在质量收益与额外开销之间提供可调平衡点，并记录 query_count 与关键耗时字段。

## Impact

- Backend
  - `backend/py/src/crystalith/shared/retrieval/context.py`：multi-query seeds 与结果合并/排序策略。
  - `backend/py/src/crystalith/shared/vector_storage/*`：必要时扩展 search_many 行为/契约（保持向后兼容）。
  - `backend/py/src/crystalith/shared/cache/*`：如启用“检索组装缓存”，复用 CacheProvider。
  - `backend/py/tests/*`：增加 multi-query 排序策略的可预期测试样例。
- 默认策略优化为主；对外 API 不做 BREAKING 变更。
