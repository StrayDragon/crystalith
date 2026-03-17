# example-gallery-and-sample-workspaces 规范增量

## ADDED Requirements

### Requirement: Example Gallery MUST Be Organized by the Same Discovery Semantics as Real Workspaces
系统 MUST 让 example gallery 复用真实 workspace 的 discovery 语义，而不是单独维护一套不可兼容样板分类。

#### Scenario: 用户在样板库中筛选示例
- **WHEN** 用户浏览 example gallery
- **THEN** 系统 SHALL 使用统一 tags、domain、goal 或等价 metadata 组织 sample workspaces
- **AND** gallery 过滤与推荐 SHALL 与真实对象发现路径保持一致

### Requirement: Sample Workspaces MUST Be Copyable into Real Usage Paths
系统 MUST 让 sample workspaces 不只是静态展示，而是可复制到真实工作流中。

#### Scenario: 用户从 gallery 选择一个示例
- **WHEN** 用户决定采用某个 sample workspace
- **THEN** 系统 SHALL 支持将其复制到个人或团队 workspace
- **AND** SHALL 为 copied sample 提供清晰的 starter path 或继续入口
