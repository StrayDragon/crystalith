# long-running-watchers-and-delta-refresh-briefs 规范增量

## ADDED Requirements

### Requirement: Watchers MUST Record Trigger Reason and Run State
系统 MUST 为长期 watcher 记录触发原因、运行状态、失败恢复信息与下一次预期触发时间。

#### Scenario: 用户查看监测器最近一次为什么运行
- **WHEN** 用户打开某个 watcher 的运行历史
- **THEN** 系统 SHALL 展示最近一次运行的触发原因、状态和输入变化摘要
- **AND** SHALL 展示失败重试或暂停状态

### Requirement: Delta Briefs MUST Summarize Meaningful Changes
系统 MUST 为 watcher 或 source pack 的刷新结果生成可阅读的 delta brief，而不是只返回底层差异列表。

#### Scenario: 刷新后查看最值得关注的变化
- **WHEN** 某个 watcher 完成一次刷新
- **THEN** 系统 SHALL 返回新增、删除、显著修改与风险变化的摘要
- **AND** SHALL 给出重读建议或后续动作提示

### Requirement: Reliability Regression MUST Feed Monitoring Decisions
系统 MUST 将来源可靠性退化信号接入 watcher 与 refresh lifecycle，而不是作为孤立告警存在。

#### Scenario: 来源出现趋势性退化
- **WHEN** 系统识别某来源在一段时间内持续退化
- **THEN** watcher 输出 SHALL 包含对应的 regression/watch flag
- **AND** 系统 SHALL 能给出补抓、重排或谨慎使用建议
