# observability-bundle 规范增量

## ADDED Requirements

### Requirement: Correlation ID Propagation
系统 MUST 生成并贯穿 `correlation_id`（用户动作级），在 HTTP、SSE、后台任务与上游调用中强制透传。

#### Scenario: 同一次动作串起链路
- **WHEN** 用户触发一次会产生检索与模型调用的动作
- **THEN** 所有关联日志/事件/调用都包含相同的 `correlation_id`

### Requirement: Structured Logging Baseline
系统 SHALL 输出结构化日志（JSON）。每条日志 MUST 包含 `timestamp`、`level`、`message` 和 `correlation_id` 字段，并遵循统一脱敏规则。

#### Scenario: JSON 日志可机器消费
- **WHEN** 系统以 JSON 模式输出日志
- **THEN** 每行日志为有效 JSON
- **AND** 包含 `correlation_id`

### Requirement: Health Endpoints
系统 SHALL 提供 `/health`（存活检查）和 `/ready`（就绪检查）端点。`/ready` MUST 验证数据库与向量存储等关键依赖可用。

#### Scenario: 就绪检查通过
- **WHEN** 数据库和向量存储均可连接
- **THEN** `/ready` 返回 200

#### Scenario: 就绪检查失败
- **WHEN** 数据库不可连接
- **THEN** `/ready` 返回 503

### Requirement: Metrics Export (Optional)
系统 SHALL 支持可选的指标导出端点 `/metrics`（Prometheus exposition format），覆盖关键耗时与错误率指标。

#### Scenario: Prometheus 抓取
- **WHEN** Prometheus 抓取 `/metrics`
- **THEN** 返回 Prometheus 文本格式的指标数据

### Requirement: Distributed Tracing (Optional)
系统 SHOULD 支持可选的 OpenTelemetry 分布式追踪。启用后，每个请求 MUST 生成 span，关键子步骤 SHOULD 生成 child span。

#### Scenario: 追踪导出
- **WHEN** 配置中启用 tracing 并指定 OTLP 端点
- **THEN** trace 数据自动导出到指定的收集器

### Requirement: Diagnostic Bundle Export
系统 SHALL 支持给定 `correlation_id` 导出默认脱敏的诊断包，用于复现输入与定位问题。

#### Scenario: 导出诊断包
- **WHEN** 用户或开发者提供某次动作的 `correlation_id`
- **THEN** 系统返回该动作的诊断包（默认脱敏）

### Requirement: Client-visible Diagnostic Handle
系统 MUST 让客户端能够稳定获取一次动作的 `correlation_id` 与关键 timings 摘要，以便跳转或复制到 diagnostics surface。

#### Scenario: 前端显示可复制排障码
- **WHEN** 一次动作结束或失败
- **THEN** 客户端可从响应、SSE 最终事件或等价输出中获取 `correlation_id`
- **AND** 客户端可将该标识用于 diagnostics workbench 或 export pack
