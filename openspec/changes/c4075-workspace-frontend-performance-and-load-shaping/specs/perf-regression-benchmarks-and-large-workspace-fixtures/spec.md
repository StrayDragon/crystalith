# perf-regression-benchmarks-and-large-workspace-fixtures 规范增量

## ADDED Requirements

### Requirement: Large Workspace Fixtures MUST Be Deterministic
系统 MUST 提供可重放的大工作区性能夹具，确保同一场景的性能比较可复现。

#### Scenario: 使用同一 seed 生成压力场景
- **WHEN** 系统生成 large-workspace fixture
- **THEN** 相同 seed SHALL 生成相同数据分布与对象规模
- **AND** 该夹具 SHALL 可用于重复 benchmark 与回归对比

### Requirement: Benchmarks MUST Cover Representative Slow Paths
系统 MUST 用少量但代表性的 benchmark 动作覆盖最容易退化的前端路径。

#### Scenario: 运行 perf benchmark 集
- **WHEN** 系统执行前端性能基准
- **THEN** SHALL 至少覆盖 workspace 进入、列表滚动、详情打开或等价慢路径
- **AND** SHALL 能与 runtime marks 和 budgets 对齐解释结果
