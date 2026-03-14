# multi-notebook-collections 规范增量

## ADDED Requirements

### Requirement: collection 必须通过绑定 notebook 构成工作现场
系统 MUST 以 notebook 绑定关系来定义 collection，而不是让 collection 脱离 notebook 独立吞并内容。

#### Scenario: 用户创建一个 collection
- **WHEN** 用户创建一个 collection
- **THEN** 系统 SHALL 允许其绑定多个 notebook
- **AND** 每个 notebook 的身份与归属 SHALL 被保留

### Requirement: collection 必须提供 collection-scoped 检索与导航
系统 MUST 为 collection 提供独立的检索与导航语义，以支持跨 notebook 工作。

#### Scenario: 用户在 collection 内查找信息
- **WHEN** 用户进入某个 collection 并发起检索或导航
- **THEN** 系统 SHALL 在 collection 绑定范围内工作
- **AND** 结果 SHALL 保留 notebook 来源上下文

### Requirement: collection 不得吞掉 notebook 原生语义
系统 MUST 保证 collection 是空间放大层，而不是 notebook 的替代品。

#### Scenario: 用户从 collection 回到 notebook
- **WHEN** 用户在 collection 中查看某条结果或对象
- **THEN** 系统 SHALL 能回溯其所属 notebook
- **AND** notebook 原生能力 SHALL 保持可访问

### Requirement: 系统必须提供 collection 的管理与 notebook 绑定接口
系统 MUST 提供 collection 的列表/详情/更新能力，并允许用户将多个 notebook 绑定到同一个 collection 作为工作上下文。

#### Scenario: 用户将 notebook 绑定到 collection
- **WHEN** 用户把一个 notebook 加入某个 collection
- **THEN** 系统 SHALL 更新该 collection 的绑定关系
- **AND** 后续 collection-scoped 检索与生成 SHALL 在该绑定范围内生效

#### Scenario: 用户从 collection 中移除 notebook
- **WHEN** 用户将某个 notebook 从 collection 中移除
- **THEN** 系统 SHALL 更新绑定关系并使其不再参与该 collection 的检索与生成
