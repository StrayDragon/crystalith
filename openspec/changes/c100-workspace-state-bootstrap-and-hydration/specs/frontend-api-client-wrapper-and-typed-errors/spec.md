# frontend-api-client-wrapper-and-typed-errors 规范增量

## ADDED Requirements

### Requirement: Frontend API Calls MUST Return Typed Errors Instead of Raw Exceptions
系统 MUST 让前端 API 调用返回稳定的 typed error，而不是要求组件直接消费原始异常。

#### Scenario: 接口返回统一错误信封
- **WHEN** 某个前端调用收到错误响应
- **THEN** 前端 wrapper SHALL 输出可判定的 `ApiError`
- **AND** SHALL 保留 `error_code`、`message`、`hint` 与 `correlation_id`

### Requirement: Cancellation MUST Be a First-class Client Outcome
系统 MUST 将请求取消表达为前端可识别的正常生命周期结果，而不是普通失败。

#### Scenario: 用户切换面板导致请求取消
- **WHEN** 前端因 scope 变更而 abort 某请求
- **THEN** 客户端 wrapper SHALL 将其表达为取消结果或稳定 abort error
- **AND** UI SHALL 不把它渲染成普通错误

### Requirement: Stream and Request Lifecycles MUST Share Resource Guards
系统 MUST 让普通请求与 SSE/stream 生命周期共享一致的资源护栏和清理策略。

#### Scenario: 页面离开后关闭无关连接
- **WHEN** 用户离开某个 run/session 或页面
- **THEN** 前端 SHALL 关闭不再需要的 stream 或 inflight 请求
- **AND** SHALL 避免旧连接继续消耗资源或推送过期状态
