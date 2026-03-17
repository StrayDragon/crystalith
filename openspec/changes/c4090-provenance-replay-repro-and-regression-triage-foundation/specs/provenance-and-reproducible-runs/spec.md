# provenance-and-reproducible-runs 规范增量

## ADDED Requirements

### Requirement: Formal Results MUST Carry a Reusable Provenance Package
系统 MUST 为 run、artifact 或等价正式结果提供可复用 provenance package，而不是只留静态说明文本。

#### Scenario: 用户查看某个结果的来源链
- **WHEN** 用户打开某个 run 或 artifact 的 provenance
- **THEN** 系统 SHALL 能展示其关键输入、模型/工具摘要、来源引用与生成时间
- **AND** 这些信息 SHALL 可被导出、重放或对比复用

### Requirement: Provenance MUST Support Version-aware Comparison
系统 MUST 让 provenance 能支撑不同时间或不同配置下的结果比较，而不是只记录单次快照。

#### Scenario: 用户比较同一目标的两个版本结果
- **WHEN** 两次运行或两个 artifact 版本需要对比
- **THEN** 系统 SHALL 能基于 provenance 解释输入或配置差异
- **AND** SHALL 支持稳定 diff 入口
