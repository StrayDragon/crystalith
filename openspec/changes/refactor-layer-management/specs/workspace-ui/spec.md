## ADDED Requirements

### Requirement: 统一层级管理系统

系统 **MUST** 提供统一的 z-index 层级管理机制，确保弹窗、通知、提示等层叠元素按预期顺序显示。

#### Scenario: 层级常量定义

- **WHEN** 开发者需要为组件设置 z-index
- **THEN** 系统提供语义化层级常量（base、dropdown、popover、modal、toast、tooltip）
- **AND** 层级值按固定优先级排序：base < dropdown < popover < modal < toast < tooltip

#### Scenario: 声明式层级 API

- **WHEN** 开发者在组件中使用 `useLayer` hook
- **THEN** 可通过传入层级名称获取对应的 z-index 值
- **AND** 无需手动管理具体的数字值

#### Scenario: 动态层级 slot

- **WHEN** 同一层级存在多个元素（如多个 Toast）
- **THEN** 开发者可传入 slot 参数区分优先级
- **AND** 后出现的元素自动获得更高的 z-index

## MODIFIED Requirements

### Requirement: 批量添加搜索结果到来源

系统 **MUST** 支持批量添加搜索结果到来源，并正确处理多层对话框的显示层级。

#### Scenario: 批量添加到来源

- **WHEN** 用户选择多个搜索结果并点击添加按钮
- **THEN** 系统显示添加进度对话框
- **AND** 逐个处理选中的结果
- **AND** 完成后刷新来源列表

#### Scenario: 从全屏模式触发添加

- **WHEN** 用户在全屏搜索结果对话框中点击添加按钮
- **THEN** 系统先关闭全屏对话框
- **AND** 显示添加进度对话框
- **AND** 进度对话框显示在最上层，不被其他元素遮挡

#### Scenario: 添加进度对话框层级

- **WHEN** 添加进度对话框打开
- **THEN** 对话框使用 `modal` 层级
- **AND** 对话框内的下拉菜单使用 `dropdown` 层级并正确显示在对话框之上
- **AND** Toast 通知使用 `toast` 层级并显示在所有对话框之上

### Requirement: 来源详情对话框

系统必须（SHALL）提供来源详情对话框，展示来源的完整信息并支持交互操作。

#### Scenario: 显示来源摘要

- **WHEN** 用户打开来源详情对话框
- **THEN** 系统调用 `/sources/{id}/summary` API
- **AND** 展示来源摘要内容
- **AND** 摘要加载时显示加载状态

#### Scenario: 显示关键词标签

- **WHEN** 来源详情加载完成
- **THEN** 显示来源关键词作为可点击标签
- **AND** 点击标签可触发相关搜索

#### Scenario: 显示统计信息

- **WHEN** 来源详情加载完成
- **THEN** 显示字数统计
- **AND** 显示页数（如适用）
- **AND** 显示上传时间

#### Scenario: 在来源内提问

- **WHEN** 用户在来源详情中输入问题
- **AND** 点击发送
- **THEN** 系统仅使用当前来源作为上下文进行问答
- **AND** 答案展示在详情面板内

#### Scenario: 对话框内弹出菜单层级

- **WHEN** 用户在来源详情对话框内点击下拉菜单
- **THEN** 菜单使用 `dropdown` 层级
- **AND** 菜单显示在对话框内容之上但不超出对话框边界
