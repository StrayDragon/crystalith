# workspace-metadata-tags-and-discovery 规范增量

## ADDED Requirements

### Requirement: Workspace Objects MUST Share a Unified Discovery Metadata Layer
系统 MUST 为 workspace、notebook、artifact、source 等对象提供统一 metadata layer，而不是让发现语义散在标题和人工习惯中。

#### Scenario: 用户查找某类对象
- **WHEN** 用户按标签、owner、domain、敏感级别或有效期查找对象
- **THEN** 系统 SHALL 使用统一 metadata 字段进行过滤与展示
- **AND** 不同对象类型 SHALL 共享可比较的 discovery 语义

### Requirement: Metadata Inheritance MUST Support Shared but Overrideable Discovery Semantics
系统 MUST 允许来源、产物、模板和工作区共享 metadata 语义，同时支持受控覆盖。

#### Scenario: 某个 artifact 继承其上游 workspace 的标签
- **WHEN** 系统为对象计算 discovery metadata
- **THEN** 系统 SHALL 支持从上层对象继承 tags 或相关元数据
- **AND** SHALL 定义哪些字段可覆盖、哪些字段应保持一致
