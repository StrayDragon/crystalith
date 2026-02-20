## ADDED Requirements

### Requirement: Embedding Cache Benchmark and Observability
系统 MUST 提供用于评估 embedding 共享缓存（Redis）收益与成本的基准能力，并输出可观测统计（至少包括 hit/miss、关键阶段耗时与内存占用摘要），以支持上线前压测与上线后回归。

#### Scenario: 可重复运行 benchmark
- **WHEN** 开发者运行 embedding cache benchmark 工具
- **THEN** 工具 MUST 输出机器可读或人类可读的摘要（命中率、耗时、内存/键数量等）

#### Scenario: hit/miss 统计可获取
- **WHEN** embedding 共享缓存被启用
- **THEN** 系统 MUST 能提供每次 embed_batch 的 hit/miss 统计（或等价统计），便于压测采集
