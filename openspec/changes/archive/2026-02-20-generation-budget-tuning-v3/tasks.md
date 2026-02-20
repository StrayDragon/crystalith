## 1. Extend tuning model

- [x] 1.1 扩展 tuning 表达：将 retrieval 相关默认参数纳入 tuning（multi_query/seed_cap、max_chunks_per_source、token_budget_ratio 或 tokens）
- [x] 1.2 为 quality/speed 增加按 OutputType 的 tuning 表，并保留对未知类型的保守回退
- [x] 1.3 增加单元测试：覆盖 OutputType + preference 的 tuning 解析与显式参数优先规则

## 2. Wire tuning into retrieval

- [x] 2.1 让 multi-query 启用与 seeds 上限由 tuning 驱动（仍允许 env 强制开/关作为 override）
- [x] 2.2 将 token budget 与 per-source cap 的默认值接入 tuning（不改变显式传参行为）
- [x] 2.3 增加回归测试：验证 query_count/budget/max_chunks 在不同 OutputType 下按预期变化

## 3. Log effective tuning

- [x] 3.1 在 outputs/slides 的“creating output/context resolved”日志中输出 effective tuning 与 query_count
- [x] 3.2 补齐文档：说明 tuning 的默认覆盖规则与如何显式覆盖
