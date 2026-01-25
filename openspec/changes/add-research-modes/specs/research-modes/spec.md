## ADDED Requirements

### Requirement: 研究模式选择

系统 **MUST** 提供多种研究模式供用户选择，以适应不同的搜索深度需求。

#### Scenario: 用户选择 Fast Research 模式
- **WHEN** 用户选择 Fast Research 模式并输入搜索关键词
- **THEN** 系统执行单次快速搜索（现有行为）
- **AND** 返回搜索结果列表

#### Scenario: 用户选择 Deep Research 模式
- **WHEN** 用户选择 Deep Research 模式并输入研究主题
- **THEN** 系统创建研究会话
- **AND** 显示研究胶囊（ResearchCapsule）在搜索队列中
- **AND** Agent 开始生成搜索计划

### Requirement: 研究会话管理

系统 **MUST** 支持创建、查看和管理研究会话。

#### Scenario: 创建研究会话
- **WHEN** 用户提交深度研究主题
- **THEN** 系统创建 ResearchSession 记录
- **AND** 会话状态为 "planning"
- **AND** 返回会话 ID

#### Scenario: 查看研究会话列表
- **WHEN** 用户请求查看研究会话列表
- **THEN** 系统返回当前 notebook 下所有研究会话
- **AND** 包含每个会话的状态、主题、进度

#### Scenario: 取消研究会话
- **WHEN** 用户取消正在进行的研究会话
- **THEN** 系统停止当前研究图执行
- **AND** 会话状态变为 "cancelled"
- **AND** 保留已收集的部分结果

### Requirement: 搜索计划生成与审批

系统 **MUST** 在每轮搜索前生成计划并等待用户审批。

#### Scenario: Agent 生成搜索计划
- **WHEN** 进入搜索规划阶段
- **THEN** Agent 基于主题和历史结果生成搜索计划
- **AND** 计划包含 1-5 个搜索查询
- **AND** 每个查询包含关键词、引擎、优先级、理由

#### Scenario: 用户批准搜索计划
- **WHEN** 用户点击"批准"按钮
- **THEN** 系统使用当前计划执行搜索
- **AND** 会话状态变为 "searching"

#### Scenario: 用户修改搜索计划
- **WHEN** 用户修改搜索查询列表并提交
- **THEN** 系统使用修改后的计划执行搜索
- **AND** 记录用户修改为 ResearchStep

#### Scenario: 用户跳过当前轮
- **WHEN** 用户点击"跳过"按钮
- **THEN** 系统跳过当前轮搜索
- **AND** 进入下一轮规划或生成报告

#### Scenario: 用户提前结束研究
- **WHEN** 用户点击"结束研究"按钮
- **THEN** 系统直接生成最终报告
- **AND** 会话状态变为 "completed"

### Requirement: 多轮迭代搜索

系统 **MUST** 支持多轮迭代搜索，自动扩展关键词。

#### Scenario: 执行搜索轮次
- **WHEN** 搜索计划被批准
- **THEN** 系统依次执行计划中的搜索查询
- **AND** 实时更新搜索进度
- **AND** 聚合本轮搜索结果

#### Scenario: 关键词扩展
- **WHEN** Agent 生成下一轮搜索计划
- **THEN** 基于已有结果进行关键词扩展
- **AND** 扩展策略包括：同义词、相关概念、子主题、深入问题

#### Scenario: 结果分析与决策
- **WHEN** 本轮搜索完成
- **THEN** Agent 分析结果覆盖度
- **AND** 决定是否需要更多搜索
- **AND** 如果达到最大轮次或覆盖度充足，进入报告生成

### Requirement: 实时进度更新

系统 **MUST** 通过 SSE 流式推送研究进度。

#### Scenario: 订阅研究进度
- **WHEN** 前端连接 SSE 端点
- **THEN** 系统开始推送进度事件
- **AND** 事件类型包括：progress, plan_ready, search_progress, search_result, analysis, report, done, error

#### Scenario: 显示搜索进度
- **WHEN** 搜索正在执行
- **THEN** 前端显示当前轮次、查询进度、已找到结果数
- **AND** 进度条实时更新

#### Scenario: 显示等待用户状态
- **WHEN** 会话状态为 "waiting_user"
- **THEN** 前端显示搜索计划审批界面
- **AND** 高亮显示待操作区域

### Requirement: 研究结果处理

系统 **MUST** 对搜索结果进行去重、聚合和排序。

#### Scenario: 结果去重
- **WHEN** 多轮搜索产生结果
- **THEN** 系统基于 URL 去除重复结果
- **AND** 保留相关性最高的条目

#### Scenario: 结果排序
- **WHEN** 显示聚合结果
- **THEN** 按相关性和新鲜度排序
- **AND** 显示来源轮次和引擎

#### Scenario: 添加结果到来源
- **WHEN** 用户选择结果并点击"添加到来源"
- **THEN** 系统批量添加选中的搜索结果为来源
- **AND** 支持 link 或 fetch 模式

### Requirement: 研究报告生成

系统 **MUST** 在研究完成时生成总结报告。

#### Scenario: 生成最终报告
- **WHEN** 研究会话完成
- **THEN** Agent 生成 Markdown 格式的研究报告
- **AND** 报告包含：主题摘要、主要发现、信息来源、建议下一步

#### Scenario: 生成子报告
- **WHEN** 每轮迭代分析完成
- **THEN** 生成该轮次的分析子报告
- **AND** 子报告记录在 ResearchStep 中

### Requirement: 研究产出导出

系统 **MUST** 允许用户灵活选择将研究产出导出到不同位置。

#### Scenario: 显示导出选择器
- **WHEN** 研究完成或用户点击导出按钮
- **THEN** 显示导出选择器对话框
- **AND** 分类显示所有产出（主报告、子报告、引用链接）
- **AND** 引用链接按相关度分组（高/中/低）

#### Scenario: 导出报告到来源
- **WHEN** 用户选择将报告导出到"来源"
- **THEN** 创建 Source 记录，类型为 research_report
- **AND** 报告内容自动分块和向量化
- **AND** 显示导入成功提示

#### Scenario: 导出报告到输出
- **WHEN** 用户选择将报告导出到"输出"
- **THEN** 显示输出类型选择器（structured, bullets, paragraph 等）
- **AND** 调用 Output 生成流程
- **AND** 保留原始引用关系

#### Scenario: 批量导出引用链接
- **WHEN** 用户选择多个引用链接并点击导出
- **THEN** 显示导入模式选择（抓取内容/仅链接）
- **AND** 如果选择抓取，显示提取器选择
- **AND** 批量创建 Source 记录
- **AND** 显示导入进度和结果

#### Scenario: 一键导入报告
- **WHEN** 用户点击"一键导入报告"快捷按钮
- **THEN** 仅将主研究报告导入到来源
- **AND** 跳过选择器直接执行

#### Scenario: 导入全部高相关
- **WHEN** 用户点击"导入全部高相关"快捷按钮
- **THEN** 导入主报告和所有高相关度引用
- **AND** 引用使用默认导入模式（仅链接）

#### Scenario: 导出失败处理
- **WHEN** 部分导出项失败（如链接抓取失败）
- **THEN** 显示失败项列表和原因
- **AND** 成功项不受影响
- **AND** 提供重试选项
