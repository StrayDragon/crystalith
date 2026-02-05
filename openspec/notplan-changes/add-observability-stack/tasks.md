## 1. 结构化日志
- [ ] 1.1 统一日志格式为 JSON（结构化字段：timestamp, level, message, request_id, module）
- [ ] 1.2 为每个请求生成唯一 request_id 并贯穿整个请求链路
- [ ] 1.3 关键操作添加日志（source 上传、AI 调用、嵌入计算）
- [ ] 1.4 编写日志格式的验证测试

## 2. 性能指标
- [ ] 2.1 创建 Metrics 中间件（收集 API 响应时间、状态码分布）
- [ ] 2.2 添加 AI 调用延迟指标（按 provider 分类）
- [ ] 2.3 添加向量搜索耗时指标
- [ ] 2.4 添加 /metrics 端点（Prometheus 格式导出）
- [ ] 2.5 编写指标收集的测试

## 3. 分布式追踪
- [ ] 3.1 集成 OpenTelemetry SDK
- [ ] 3.2 HTTP 请求自动生成 trace span
- [ ] 3.3 AI 调用、数据库查询、向量搜索创建子 span
- [ ] 3.4 支持导出到 OTLP 端点（可选）
- [ ] 3.5 编写追踪集成的测试

## 4. 健康检查
- [ ] 4.1 实现 /health 端点（基础存活检查）
- [ ] 4.2 实现 /ready 端点（检查数据库连接、向量存储可用性）
- [ ] 4.3 编写健康检查的测试

## 5. 配置
- [ ] 5.1 添加 observability 配置段（log_level, log_format, metrics_enabled, tracing_enabled, otlp_endpoint）
- [ ] 5.2 编写配置验证测试

## 6. 验证
- [ ] 6.1 验证日志输出为有效 JSON 格式
- [ ] 6.2 验证 /metrics 端点返回 Prometheus 格式数据
- [ ] 6.3 验证 request_id 在整个请求链路中一致
- [ ] 6.4 验证 /health 和 /ready 端点正常工作
