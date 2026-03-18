# perf-ci-report-diff-and-baseline-management 规范增量

## ADDED Requirements

### Requirement: Perf Reports MUST Diff Against Stable Baselines
系统 MUST 将性能报告与稳定 baseline 做 diff，而不是只输出孤立的耗时数字。

#### Scenario: PR 引入新的性能报告
- **WHEN** 某次变更产出 perf report
- **THEN** 系统 SHALL 将其与对应场景 baseline 做比较
- **AND** SHALL 输出明确的 regression diff，而不是仅给出原始指标

### Requirement: Baseline Policy MUST Account for Noise Bands
系统 MUST 为性能门禁定义噪声带与例外策略，避免把正常抖动误判成回归。

#### Scenario: 指标发生小幅波动
- **WHEN** 某项性能指标只在预设 noise band 内轻微波动
- **THEN** 系统 SHALL 将其视为可接受波动
- **AND** 超出阈值时 SHALL 才升级为明确回归或 gate 候选
