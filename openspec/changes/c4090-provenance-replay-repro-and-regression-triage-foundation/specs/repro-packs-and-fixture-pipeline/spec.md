# repro-packs-and-fixture-pipeline 规范增量

## ADDED Requirements

### Requirement: Failing or Interesting Runs MUST Be Exportable as Repro Packs
系统 MUST 支持将一次 run 或 output 导出为 repro pack，而不是要求人工重建现场。

#### Scenario: 用户或工程师需要复现一次结果
- **WHEN** 某次运行需要被复现、分享或带入回归
- **THEN** 系统 SHALL 能导出包含 input snapshot、关键配置与诊断摘要的 repro pack
- **AND** SHALL 明确其可重放与仅供诊断的边界

### Requirement: Repro Packs MUST Flow into Sanitized Fixtures
系统 MUST 允许 repro packs 经过脱敏和最小化后进入 fixture pipeline，而不是让回归样本与真实现场脱节。

#### Scenario: 某个 repro pack 被纳入长期回归集
- **WHEN** 团队决定将一次 repro 转成长期 fixture
- **THEN** 系统 SHALL 先执行 sanitization 和 minimization
- **AND** SHALL 记录该 fixture 的 lineage 与适用范围
