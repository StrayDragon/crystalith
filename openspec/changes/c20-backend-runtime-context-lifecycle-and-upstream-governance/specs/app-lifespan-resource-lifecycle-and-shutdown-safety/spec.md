# app-lifespan-resource-lifecycle-and-shutdown-safety 规范增量

## ADDED Requirements

### Requirement: Backend Runtime MUST Follow an Ordered Lifespan State Machine
系统 MUST 为 startup、draining、stopping background work 和 closing resources 定义固定阶段顺序。

#### Scenario: 系统开始关闭
- **WHEN** 应用进入 shutdown
- **THEN** 系统 SHALL 先停止接受新工作
- **AND** SHALL 先停止 worker、monitor、SSE 或等价后台活动
- **AND** 之后 SHALL 再关闭 DB、cache、vector store、HTTP clients 等核心资源

### Requirement: Shutdown MUST Be Observable and Bounded
系统 MUST 让 shutdown 的关键阶段可观测且具备边界，而不是无声挂死或随机被杀。

#### Scenario: 某次关闭过程变慢
- **WHEN** shutdown 某个阶段超时或有 in-flight 工作被取消
- **THEN** 系统 SHALL 记录该阶段耗时与结果
- **AND** SHALL 能解释是哪个子系统拖慢或阻塞了关闭流程
