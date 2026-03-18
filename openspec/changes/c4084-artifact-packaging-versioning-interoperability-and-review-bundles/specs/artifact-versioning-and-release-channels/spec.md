# artifact-versioning-and-release-channels 规范增量

## ADDED Requirements

### Requirement: Formal Artifacts MUST Have Version History and Channel Semantics
系统 MUST 为正式 artifact 定义版本历史与 release channel 语义，而不是只暴露一个“当前最新”版本。

#### Scenario: 用户需要区分内部草稿与正式发布版本
- **WHEN** 某个 artifact 经历候选、审批、发布或归档流程
- **THEN** 系统 SHALL 记录稳定版本链与 channel 归属
- **AND** 不同 channel SHALL 可引用明确版本而非模糊最新态

### Requirement: Versioned Publishing MUST Support Git and PR-based Release Events
系统 MUST 允许版本化 artifact 与 Git/PR publishing 流程衔接，而不是把外部审阅视为体系外行为。

#### Scenario: 用户将 artifact 同步到 Git 并通过 PR 审阅
- **WHEN** 某个 artifact 通过 Git sync 或 PR-based publishing 进入外部审阅
- **THEN** 系统 SHALL 记录该次发布尝试与结果
- **AND** SHALL 允许将 PR 结论回写到 release history
