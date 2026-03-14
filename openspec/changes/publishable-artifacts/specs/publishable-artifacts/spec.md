# publishable-artifacts 规范增量

## ADDED Requirements

### Requirement: 结果必须能够被提升为正式产物
系统 MUST 允许符合条件的结果被提升为正式产物对象，而不是只能停留在一次性结果层。

#### Scenario: 用户把某个结果提升为 artifact
- **WHEN** 用户决定将某个结果长期保留并继续使用
- **THEN** 系统 SHALL 允许执行 promotion 动作
- **AND** SHALL 创建与该结果关联的 artifact 对象

### Requirement: artifact 必须具备独立生命周期
系统 MUST 为 artifact 提供独立生命周期与状态流转语义。

#### Scenario: artifact 在站内持续演化
- **WHEN** 用户查看某个 artifact
- **THEN** 系统 SHALL 返回其当前生命周期状态
- **AND** SHALL 支持围绕该状态进行继续编辑、归档或引用等动作

### Requirement: artifact 必须保留与来源结果的 lineage
系统 MUST 保留 artifact 与来源结果之间的关系，以支持追踪与继续演化。

#### Scenario: 用户追踪 artifact 来源
- **WHEN** 用户查看某个 artifact 的上下文
- **THEN** 系统 SHALL 能显示其来源结果或上游对象关系
- **AND** 后续基于 artifact 的继续演化 SHALL 保持可追踪 lineage

### Requirement: artifact 必须支持归档并保持可引用
系统 MUST 支持将 artifact 归档，同时保留其可查看与可引用语义，避免归档等同于删除。

#### Scenario: 用户归档一个已完成的 artifact
- **WHEN** 用户将一个 artifact 标记为 archived
- **THEN** 系统 SHALL 将其从默认活跃列表中移除或默认隐藏
- **AND** 该 artifact SHALL 仍可被查看与引用

### Requirement: artifact 必须提供稳定的站内引用标识
系统 MUST 为 artifact 提供稳定的站内引用标识（至少 artifact_id），以支持其它对象在站内引用正式产物。

#### Scenario: 其它结果或页面引用某个 artifact
- **WHEN** 某个对象需要引用一个正式产物
- **THEN** 系统 SHALL 提供可引用的 artifact 标识
- **AND** 引用 SHALL 能指向当前版本或特定版本（若提供版本）

### Requirement: v1 的 artifact 能力必须以站内沉淀为核心而非外部导出
系统 MUST 将 artifact 的 v1 核心能力聚焦于站内生命周期、继续编辑、引用与归档，而不是把外部导出/发布写成必需主线。

#### Scenario: 用户在站内持续推进 artifact
- **WHEN** 用户在站内管理一个 artifact
- **THEN** 系统 SHALL 支持其生命周期状态展示与状态流转
- **AND** SHALL 支持继续编辑与引用语义
