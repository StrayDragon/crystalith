## 1. Implement multi-query fusion

- [x] 1.1 实现 RRF（或选定策略）的融合函数（输入：每个 query 的结果列表；输出：融合排序）
- [x] 1.2 将 multi-query 合并从“max score”切换到融合策略，并保留可回退开关（用于排障/回滚）
- [x] 1.3 增加单测：固定输入列表下融合排序稳定、可预测

## 2. Improve query seeds

- [x] 2.1 设计并实现按 OutputType 的 seed hints（timeline/quiz/briefing/slides 等），并确保 seeds 数受上限控制
- [x] 2.2 增加单测：不同 OutputType 的 seeds 包含对应 hint，且去重/上限规则正确

## 3. Optional retrieval assembly cache

- [x] 3.1 评估并实现短 TTL 的检索组装缓存（key 维度最小化，优先缓存 chunk_ids）
- [x] 3.2 增加单测：相同输入命中缓存、不同输入不串扰；TTL/失效策略符合预期

## 4. Observability

- [x] 4.1 在检索日志中记录融合策略、seed_count/query_count、cache hit/miss（如启用）
