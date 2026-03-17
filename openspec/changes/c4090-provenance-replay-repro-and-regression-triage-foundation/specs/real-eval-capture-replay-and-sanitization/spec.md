# real-eval-capture-replay-and-sanitization 规范增量

## ADDED Requirements

### Requirement: Real Workspace Capture MUST Stay Opt-in, Sanitized, and Replayable
系统 MUST 让真实工作区评测捕获保持可解释、可筛选、可脱敏，而不是默认把所有现场沉淀为长期样本。

#### Scenario: 团队从真实 workspace 提取评测片段
- **WHEN** 系统捕获一个真实工作区片段用于评测
- **THEN** 该片段 SHALL 先经过明确的 capture 与 sanitization 边界
- **AND** SHALL 保留可 replay 的最小结构

### Requirement: Test Data Lineage and Refresh Cadence MUST Be Explicit
系统 MUST 为 captured fixtures 记录 lineage 与 refresh cadence，而不是让回归集无限漂移。

#### Scenario: 某个真实样本已长期偏离主线
- **WHEN** 团队评估是否更新或淘汰一个 fixture
- **THEN** 系统 SHALL 能展示其来源、清洗过程、适用范围与上次刷新时间
- **AND** SHALL 支持谨慎的 baseline exception 或 refresh 决策
