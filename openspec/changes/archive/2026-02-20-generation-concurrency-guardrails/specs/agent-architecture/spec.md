## ADDED Requirements

### Requirement: Graph Nodes Respect Concurrency and Cancellation
系统 MUST 确保 Agent/Graph 节点在执行 embedding/search/model 调用时遵循并发限制，并在请求取消时尽早退出。

#### Scenario: OutputGraph 受 limiter 保护
- **WHEN** OutputGraph 执行检索与生成阶段
- **THEN** 每个阶段 MUST 在对应 limiter 下运行（或等价保护）

#### Scenario: 取消时不继续后续节点
- **WHEN** 在图执行过程中发生请求取消
- **THEN** 图 SHOULD 不再继续执行后续昂贵节点（例如生成或持久化），或以明确的取消结果终止
