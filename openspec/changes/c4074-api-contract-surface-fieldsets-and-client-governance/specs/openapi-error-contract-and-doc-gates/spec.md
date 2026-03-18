# openapi-error-contract-and-doc-gates 规范增量

## ADDED Requirements

### Requirement: Non-2xx API Responses MUST Use Registered ErrorResponse
系统 MUST 让非 2xx 响应使用统一 `ErrorResponse` 与已注册的 `error_code`，而不是返回散装 `detail`。

#### Scenario: endpoint 返回业务或依赖错误
- **WHEN** 任一 `/v1/**` endpoint 因校验失败、依赖缺失或上游故障返回非 2xx
- **THEN** 响应 SHALL 使用统一 `ErrorResponse` 形状
- **AND** `error_code` SHALL 来自已注册集合
- **AND** SHALL 提供稳定的 `message` 与可选 `hint`、`retry_after`

### Requirement: Stream Failures MUST Emit Standardized Error Events
系统 MUST 为 SSE 或等价流式接口提供标准化 error event，而不是仅依赖连接中断或字符串消息。

#### Scenario: 流式生成中途失败
- **WHEN** 某个 SSE 或 stream endpoint 在响应过程中遇到错误
- **THEN** 系统 SHALL 发送标准化 error event
- **AND** 该事件 SHALL 携带稳定的错误字段以便客户端统一处理

### Requirement: OpenAPI Gates MUST Cover Error Contract Drift
系统 MUST 在 OpenAPI 导出与校验链路中检查错误契约覆盖率与未注册错误码。

#### Scenario: 新接口绕开统一错误契约
- **WHEN** 新增或修改的 endpoint 没有声明统一错误响应，或暴露未注册 `error_code`
- **THEN** OpenAPI/doc gate SHALL 将其标记为 contract drift
- **AND** SHALL 阻止该漂移作为新的默认模式继续扩散
