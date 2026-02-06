## Why

当前系统缺少结构化的可观测性基础设施。日志输出不够结构化，缺少性能指标收集和分布式追踪能力。在生产环境中，无法快速定位性能瓶颈、追踪请求链路或监控系统健康状态。引入可观测性栈可提升运维效率和问题排查速度。

## What Changes

- 结构化日志：统一日志格式（JSON），添加 request_id 和 trace_id
- 性能指标：收集 API 响应时间、AI 调用延迟、向量搜索耗时等关键指标
- 分布式追踪：使用 OpenTelemetry 追踪请求链路
- 健康检查端点：提供 /health 和 /ready 端点
- 可选的 Prometheus 指标导出

## Impact

- 受影响的规范：`backend-module-structure`（MODIFIED）
- 受影响的系统：
  - 后端中间件层（日志、追踪、指标）
  - cl-logs 包（结构化日志增强）
  - 配置文件（可观测性配置项）
