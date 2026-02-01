## ADDED Requirements

### Requirement: 研究详情会话一致性
系统 **MUST** 在打开研究详情前获取所选研究会话详情，并确保详情内容与所选会话一致。

#### Scenario: 打开研究详情
- **WHEN** 用户点击研究胶囊或研究历史条目
- **THEN** 系统请求并加载对应会话详情
- **AND** 详情面板展示该会话的主题、状态与轮次信息
- **AND** 不显示上一次会话的残留内容

#### Scenario: 获取失败
- **WHEN** 获取研究会话详情失败
- **THEN** 系统提示错误
- **AND** 不打开详情面板

### Requirement: SSE 连接生命周期
系统 **MUST** 仅在研究会话处于活动状态时维持 SSE 连接，并在完成或取消后释放连接。

#### Scenario: 活动会话订阅
- **WHEN** 研究会话状态为 planning/searching/analyzing/waiting_user
- **THEN** 前端建立 SSE 连接并接收进度事件

#### Scenario: 会话终止释放
- **WHEN** 研究会话状态变为 completed 或 cancelled
- **THEN** 前端关闭 SSE 连接并停止重连

### Requirement: SSE 连接状态提示
系统 **MUST** 在 SSE 连接中断或重连时提供可见提示，帮助用户理解当前连接状态。

#### Scenario: 连接中断提示
- **WHEN** SSE 连接中断并进入重连流程
- **THEN** 系统在思考列表中插入一条状态提示
- **AND** 提示包含重连延迟或原因信息

#### Scenario: 连接恢复提示
- **WHEN** SSE 连接成功恢复
- **THEN** 系统在思考列表中插入“连接已恢复”的状态提示

### Requirement: 思考过程渐进渲染
系统 **MUST** 以渐进方式渲染思考过程，避免长历史导致主线程阻塞。

#### Scenario: 默认窗口展示
- **WHEN** 思考过程包含大量历史条目
- **THEN** 默认仅展示最近一段记录
- **AND** 显示“已隐藏条目数”与“加载更多”入口

#### Scenario: 显示全部渐进展开
- **WHEN** 用户选择“显示全部”
- **THEN** 系统分批渲染历史条目
- **AND** 展示展开进度提示
- **AND** 交互保持可用

#### Scenario: 显示全部阈值确认
- **WHEN** 思考条目总数超过 500 且用户选择“显示全部”
- **THEN** 系统先提示确认
- **AND** 默认仅展示最近 500 条

#### Scenario: 超长列表虚拟/窗口化
- **WHEN** 思考条目总数超过 300
- **THEN** 系统启用虚拟列表或等效窗口化策略
- **AND** DOM 中的思考条目数量不超过 300
