## ADDED Requirements
### Requirement: Notebook 生命周期
系统 SHALL 允许用户创建、列出、重命名、删除 Notebook。

#### Scenario: 创建并列出 Notebook
- **WHEN** 用户创建一个 Notebook 并提供名称
- **THEN** 该 Notebook 出现在列表中并显示该名称

#### Scenario: 重命名 Notebook
- **WHEN** 用户重命名已有 Notebook
- **THEN** 后续列表显示更新后的名称

#### Scenario: 删除 Notebook
- **WHEN** 用户删除一个 Notebook
- **THEN** 该 Notebook 及其来源不再可访问
