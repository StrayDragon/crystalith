# cache-coverage-maps-and-cold-path-detection 规范增量

## ADDED Requirements

### Requirement: Cache Coverage MUST Be Mapped Across Critical Retrieval Paths
系统 MUST 能描绘关键 retrieval 路径上的 cache coverage，而不是只知道单点命中率。

#### Scenario: 运维查看某个工作流的缓存覆盖情况
- **WHEN** 系统分析一条 retrieval-heavy 工作流
- **THEN** SHALL 能指出哪些阶段有缓存覆盖、哪些阶段持续走冷路径
- **AND** SHALL 将这些信号与具体 cache 域对应起来

### Requirement: Cold Paths MUST Be Actionable, Not Just Observable
系统 MUST 让 cold path detection 产出可执行解释，而不是只打出“这里很冷”。

#### Scenario: 某条路径长期保持冷态
- **WHEN** 系统发现某个 retrieval path 反复走冷路径
- **THEN** SHALL 能指出其主要原因是 bypass、无覆盖、预热不足、QoS 让路或等价因素
- **AND** SHALL 能为后续 warmup、policy 调整或失效策略提供输入
