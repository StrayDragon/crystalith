## ADDED Requirements

### Requirement: Workspace Template System
系统 SHALL 支持工作区模板，允许用户保存 notebook 配置为模板并从模板创建新 notebook。系统 MUST 提供内置模板（论文研究、项目文档、知识收集）。

#### Scenario: 从模板创建 notebook
- **WHEN** 用户在新建 notebook 时选择 "论文研究" 模板
- **THEN** 新 notebook 按模板预配置好 session 结构和输出类型偏好

#### Scenario: 保存为模板
- **WHEN** 用户在 notebook 菜单中选择 "保存为模板" 并填写名称
- **THEN** 当前 notebook 的配置被保存为自定义模板，出现在模板列表中

#### Scenario: 模板管理
- **WHEN** 用户打开模板管理页面
- **THEN** 显示所有模板（内置 + 自定义），支持删除自定义模板
