# workspace-ui-core 规范增量

## ADDED Requirements

### Requirement: Workspace MUST Surface Capture and Sync State Across Small-Screen Entry Points
系统 MUST 在小屏和轻入口场景下提供可见的 capture/sync 状态入口，而不是把本地队列与冲突状态藏在后台。

#### Scenario: 用户在移动端或轻入口存在待同步变更
- **WHEN** 当前设备存在待同步、待确认或冲突中的本地变更
- **THEN** Workspace SHALL 提供可见的状态入口
- **AND** 用户 SHALL 能从该入口查看当前 queue 状态与下一步动作
