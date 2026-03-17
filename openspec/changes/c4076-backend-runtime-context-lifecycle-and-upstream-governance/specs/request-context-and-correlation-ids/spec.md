# request-context-and-correlation-ids 规范增量

## ADDED Requirements

### Requirement: Correlation Context MUST Propagate Across Request, Stream, and Task Boundaries
系统 MUST 让 `correlation_id` 与最小 RequestContext 贯穿 HTTP、SSE、task、worker 与上游调用边界。

#### Scenario: 前端动作触发后端长链路
- **WHEN** 一次用户动作触发 API、后台任务与流式事件
- **THEN** 系统 SHALL 在这些边界上传播同一个 `correlation_id`
- **AND** SHALL 让日志、响应与事件都能基于该共同键对齐

### Requirement: Response Paths MUST Expose the Correlation Context Back to Clients
系统 MUST 把 correlation context 回传给客户端，而不是只存在于后端内部。

#### Scenario: 客户端收到响应或错误
- **WHEN** 普通 HTTP 响应、SSE error event 或等价响应返回给客户端
- **THEN** 响应 SHALL 提供稳定的 `correlation_id`
- **AND** 客户端 SHALL 能直接复制该 id 用于排障或对账
