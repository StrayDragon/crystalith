## ADDED Requirements

### Requirement: 研究模式选择

系统 **MUST** 提供多种研究模式供用户选择，以适应不同的搜索深度需求。

#### Scenario: 用户选择 Fast Research 模式
- **WHEN** 用户选择 Fast Research 模式
- **THEN** 系统执行单次快速搜索
- **AND** 返回前 10 条最相关结果

#### Scenario: 用户选择 Deep Research 模式
- **WHEN** 用户选择 Deep Research 模式
- **THEN** 系统执行多轮迭代搜索
- **AND** 自动扩展搜索关键词
- **AND** 聚合去重后的搜索结果
- **AND** 显示搜索进度

#### Scenario: 研究模式切换
- **WHEN** 用户在搜索栏切换研究模式
- **THEN** 新搜索使用选定的模式
- **AND** 用户偏好被保存

### Requirement: 搜索引擎选择

系统 **MUST** 允许用户选择特定的搜索引擎来源。

#### Scenario: 用户选择特定搜索引擎
- **WHEN** 用户从下拉菜单选择搜索引擎（如 Google、Bing、DuckDuckGo）
- **THEN** 搜索请求仅使用指定的搜索引擎
- **AND** 搜索结果标注来源引擎

#### Scenario: 使用全部搜索引擎
- **WHEN** 用户未指定搜索引擎或选择"全部"
- **THEN** 系统使用 SearXNG 默认的多引擎聚合搜索

### Requirement: Deep Research 进度显示

系统 **MUST** 在深度搜索过程中向用户展示搜索进度。

#### Scenario: 显示搜索迭代进度
- **WHEN** Deep Research 搜索正在进行
- **THEN** 显示当前迭代轮次（如"第 2/5 轮"）
- **AND** 显示已找到的结果数量
- **AND** 显示扩展的搜索关键词

#### Scenario: 取消深度搜索
- **WHEN** 用户点击取消按钮
- **THEN** 搜索立即停止
- **AND** 显示已完成轮次的部分结果
