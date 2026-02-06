## ADDED Requirements

### Requirement: Structured Logging
系统 SHALL 输出 JSON 结构化日志，每条日志 MUST 包含 timestamp、level、message 和 request_id 字段。request_id SHALL 在请求入口生成并贯穿整个处理链路。

#### Scenario: 请求链路日志追踪
- **WHEN** 一个 API 请求触发数据库查询和 AI 调用
- **THEN** 所有相关日志条目包含相同的 request_id

### Requirement: Performance Metrics
系统 SHALL 收集关键性能指标（API 响应时间、AI 调用延迟、向量搜索耗时）并通过 /metrics 端点以 Prometheus 格式导出。

#### Scenario: Prometheus 指标导出
- **WHEN** Prometheus 抓取 /metrics 端点
- **THEN** 返回包含 http_request_duration_seconds、ai_call_duration_seconds 等指标的文本

### Requirement: Health Check Endpoints
系统 SHALL 提供 /health（存活检查）和 /ready（就绪检查）端点。/ready MUST 验证数据库和向量存储的连接状态。

#### Scenario: 就绪检查通过
- **WHEN** 数据库和向量存储均可连接
- **THEN** /ready 返回 200 和 {"status": "ready"}

#### Scenario: 就绪检查失败
- **WHEN** 数据库不可连接
- **THEN** /ready 返回 503 和 {"status": "not_ready", "details": {"database": "unavailable"}}

### Requirement: Distributed Tracing
系统 SHALL 支持可选的 OpenTelemetry 分布式追踪。启用后，每个请求 MUST 生成 trace span，AI 调用和数据库查询 MUST 生成子 span。

#### Scenario: 追踪导出
- **WHEN** 配置中启用 tracing 并指定 OTLP 端点
- **THEN** 请求 trace 数据自动导出到指定的 OTLP 收集器
