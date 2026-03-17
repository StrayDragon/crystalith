# goal-gap-explanations-and-missed-criteria-reports 规范增量

## ADDED Requirements

### Requirement: Missed Goal Criteria MUST Be Reported as Structured Gaps
系统 MUST 将未达成目标的原因表达为结构化 gap，而不是只给出笼统失败提示。

#### Scenario: 某次结果未满足 success criteria
- **WHEN** 系统发现某个目标条件未满足
- **THEN** 系统 SHALL 生成 missed criteria report
- **AND** SHALL 指明具体缺失项与影响范围

### Requirement: Goal Gaps MUST Lead to Actionable Follow-up Paths
系统 MUST 让 goal-gap explanations 自然连接到 follow-up suggestions、续跑或回退路径，而不是停留在解释层。

#### Scenario: 用户查看某次结果的 gap report
- **WHEN** 用户打开 goal-gap explanation
- **THEN** 系统 SHALL 提供可执行的后续动作建议
- **AND** SHALL 能区分“差一点”和“方向不对”的不同处理路径
