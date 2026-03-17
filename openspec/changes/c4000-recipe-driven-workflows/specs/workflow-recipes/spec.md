# workflow-recipes 规范增量

## ADDED Requirements

### Requirement: 系统必须提供面向任务起步的 recipe 入口
系统 MUST 提供 recipe 入口，帮助用户更容易开始一项工作。

#### Scenario: 用户从 recipe 开始一项工作
- **WHEN** 用户准备发起一项新的知识工作
- **THEN** 系统 SHALL 提供可选的 recipe 入口
- **AND** 每个入口 SHALL 至少说明适用场景、所需输入与预期产出

### Requirement: recipe 启动后必须保持可编辑
系统 MUST 允许用户在 recipe 启动后继续编辑目标、输入和参数，而不是把 recipe 执行成锁定流程。

#### Scenario: 用户启动 recipe 后调整起步配置
- **WHEN** 用户基于某个 recipe 启动任务
- **THEN** 系统 SHALL 预填默认内容和建议参数
- **AND** 用户 SHALL 可以继续修改这些内容后再正式开始工作

### Requirement: recipe 必须表达步骤建议而不是重写生成类型
系统 MUST 将 recipe 约束在工作推进建议层，不得把 recipe 变成另一套生成类型定义系统。

#### Scenario: recipe 与生成类型共存
- **WHEN** 某个 recipe 附带推荐步骤
- **THEN** recipe SHALL 描述建议步骤、节奏或常用动作
- **AND** SHALL NOT 直接取代生成类型框架的公共词汇定义
