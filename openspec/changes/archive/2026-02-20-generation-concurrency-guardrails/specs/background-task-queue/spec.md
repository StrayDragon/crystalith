## ADDED Requirements

### Requirement: Background Tasks Use the Same Guardrails
系统 MUST 确保后台任务队列（如 refine 生成队列）同样遵循并发限制与重试/取消策略，避免与前台请求互相挤占资源。

#### Scenario: 队列任务遵循 limiter
- **GIVEN** 配置设置 LLM generation 并发上限为 N
- **WHEN** 后台队列同时执行多个生成任务
- **THEN** 系统 MUST 限制并发执行数不超过 N
