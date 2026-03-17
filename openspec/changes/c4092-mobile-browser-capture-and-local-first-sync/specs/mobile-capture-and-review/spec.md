# mobile-capture-and-review 规范增量

## ADDED Requirements

### Requirement: Mobile Capture MUST Use the Same Local-First Queue as Desktop Flows
系统 MUST 让移动端 capture、轻量编辑和 review actions 进入统一 local-first queue，而不是维护独立的移动暂存机制。

#### Scenario: 用户在手机上补录一条来源
- **WHEN** 用户通过移动端分享入口、快速表单或轻量编辑创建一个 capture draft
- **THEN** 系统 SHALL 将该变更写入统一 draft queue
- **AND** SHALL 显示其待同步、待确认或已同步状态

### Requirement: Mobile Review MUST Surface Sync and Conflict State Explicitly
系统 MUST 在移动端 review flow 中显式展示同步状态和冲突状态，而不是让用户在提交后才发现失败。

#### Scenario: 移动端 review 动作遇到同步风险
- **WHEN** 用户在移动端执行某个 review action 且该动作需要等待同步或存在冲突风险
- **THEN** 系统 SHALL 提前展示对应状态与下一步动作
- **AND** SHALL 区分可直接提交、需要确认和不可直接提交三类结果
