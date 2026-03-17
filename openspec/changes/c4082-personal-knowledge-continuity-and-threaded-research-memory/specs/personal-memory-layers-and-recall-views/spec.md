# personal-memory-layers-and-recall-views 规范增量

## ADDED Requirements

### Requirement: Personal Work History MUST Be Projected into Memory Layers
系统 MUST 将个人工作轨迹投影为可区分的 memory layers，而不是只保留扁平最近列表。

#### Scenario: 用户回看过去的工作痕迹
- **WHEN** 用户需要从近期热记忆、工作记忆或冷存档中回看内容
- **THEN** 系统 SHALL 提供稳定的 memory layer 视图
- **AND** SHALL 允许对象、时间与停下位置作为回看入口

### Requirement: Recall Views MUST Reassemble Multi-object Work Fragments
系统 MUST 让 recall views 能把 notes、sources、runs、outputs 与 decisions 重新组织成可重返的 work fragments。

#### Scenario: 用户试图找回“上次为什么停在这里”
- **WHEN** 用户打开某个 recall view
- **THEN** 系统 SHALL 能重建与该段工作相关的关键对象与上下文片段
- **AND** SHALL 不要求用户手动翻遍多个列表
