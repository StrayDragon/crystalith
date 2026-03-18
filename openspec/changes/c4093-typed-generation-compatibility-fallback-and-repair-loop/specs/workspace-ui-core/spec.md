# workspace-ui-core 规范增量

## ADDED Requirements

### Requirement: Workspace MUST Explain Generation Compatibility and Recovery States to Users
系统 MUST 在生成入口和结果页显式解释 compatibility warning、fallback、retry 建议和 repair state，而不是只显示抽象错误或静默替换结果。

#### Scenario: 某次生成触发治理状态
- **WHEN** 某个生成请求触发 preflight warning、fallback、retry recommendation 或 repair state
- **THEN** Workspace SHALL 展示对应状态与可执行下一步
- **AND** 用户 SHALL 能区分这是正常成功、降级成功还是待修补结果
