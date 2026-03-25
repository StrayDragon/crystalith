# claim-map-views-and-argument-tracebacks 规范增量

## ADDED Requirements

### Requirement: Confirmed Claims MUST Be Traceable Back to Source Evidence
系统 MUST 让已确认 claim 能稳定回溯到 source evidence，而不是只停在抽象结论层。

#### Scenario: 用户从 claim 回看证据
- **WHEN** 用户在 claim map 中选择某个 claim
- **THEN** 系统 SHALL 能展示对应 citation、source locator 或 evidence sidecar
- **AND** SHALL 支持进一步打开 source highlights

### Requirement: Claim Maps MUST Surface Strength and Counterevidence Signals
系统 MUST 在 claim map 中展示主张强弱与反证压力，而不是只画连接关系。

#### Scenario: 用户查看主张薄弱点
- **WHEN** 用户浏览某条 claim 的详情
- **THEN** 系统 SHALL 展示 claim strength、evidence weight 或 counterevidence 相关摘要
- **AND** SHALL 支持将这些薄弱点回接到 review 或 follow-up 动作

### Requirement: Argument Traceback MUST Connect Output Paragraphs to Claims
系统 MUST 支持从输出段落反向追到 claim、claim candidate 或 argument skeleton 节点。

#### Scenario: 用户从最终段落回溯论证链
- **WHEN** 用户在输出中选择一段文字并请求 traceback
- **THEN** 系统 SHALL 返回该段落关联的 claim 或 argument path
- **AND** SHALL 保持与 citation review 使用一致的定位语义
