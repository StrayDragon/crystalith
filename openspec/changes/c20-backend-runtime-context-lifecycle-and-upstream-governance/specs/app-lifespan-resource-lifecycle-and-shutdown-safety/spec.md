# app-lifespan-resource-lifecycle-and-shutdown-safety 规范增量

## ADDED Requirements

### Requirement: Backend Runtime MUST Follow an Ordered Lifespan State Machine
系统 MUST 为 startup、draining、stopping background work 和 closing resources 定义固定阶段顺序。

#### Scenario: 系统开始关闭
- **WHEN** 应用进入 shutdown
- **THEN** 系统 SHALL 先停止接受新工作
- **AND** SHALL 先停止 worker、monitor、SSE 或等价后台活动
- **AND** 之后 SHALL 再关闭 DB、cache、vector store、HTTP clients 等核心资源

### Requirement: Plugin Lifecycle MUST Participate in Lifespan Ordering
系统 MUST 让“插件装配”参与统一 lifespan contract，而不是只能在启动时静态加载。

#### Scenario: 插件需要在启动或关闭阶段管理资源
- **WHEN** 某插件需要在 startup 初始化资源或在 shutdown 释放资源
- **THEN** 宿主 SHALL 提供稳定的生命周期挂接点（例如可选 hooks 或资源关闭注册）
- **AND** 宿主 SHALL 确保插件资源的关闭顺序不破坏既定的 shutdown 阶段顺序
- **AND** 插件生命周期失败 SHALL 可诊断（包含 plugin_id、阶段与恢复提示）

### Requirement: Shutdown MUST Be Observable and Bounded
系统 MUST 让 shutdown 的关键阶段可观测且具备边界，而不是无声挂死或随机被杀。

#### Scenario: 某次关闭过程变慢
- **WHEN** shutdown 某个阶段超时或有 in-flight 工作被取消
- **THEN** 系统 SHALL 记录该阶段耗时与结果
- **AND** SHALL 能解释是哪个子系统拖慢或阻塞了关闭流程
