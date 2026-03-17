# outcome-goals-and-impact-tracking 规范增量

## ADDED Requirements

### Requirement: Artifacts and Runs MUST Be Linkable to Longer-horizon Outcome Goals
系统 MUST 允许 notebook、run、artifact 或 briefing 挂接到更长期的 outcome goals，而不是只停留在一次次局部执行。

#### Scenario: 用户希望查看某个目标下的相关工作
- **WHEN** 用户打开某个长期 outcome goal
- **THEN** 系统 SHALL 能展示与之相关的 sources、runs、artifacts 和阶段性结论
- **AND** SHALL 支持目标级进展与影响摘要

### Requirement: Goal Tracking MUST Feed Goal-level Guidance
系统 MUST 让 impact tracking 结果反过来影响目标级 guidance，而不是只做静态状态展示。

#### Scenario: 某个长期目标长期缺少关键资料或审阅
- **WHEN** outcome goal 的推进卡住或缺少关键支撑
- **THEN** 系统 SHALL 能生成目标级下一步建议
- **AND** SHALL 让这些建议可回接到具体 workspace actions
