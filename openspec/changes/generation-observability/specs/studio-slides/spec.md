## ADDED Requirements

### Requirement: Optional timings in slides SSE done event
系统 MUST 支持在 debug 模式下为 slides SSE `done` 事件附带 `timings_ms` 字段，用于展示阶段耗时分解；默认 MUST 不输出该字段。

#### Scenario: debug 开启时输出 timings_ms
- **WHEN** debug timings 开关启用
- **AND** 用户触发 slides outline 或 markdown 生成
- **THEN** SSE `done` 事件 payload 包含 `timings_ms`

#### Scenario: debug 关闭时不输出 timings_ms
- **WHEN** debug timings 开关未启用
- **AND** 用户触发 slides outline 或 markdown 生成
- **THEN** SSE `done` 事件 payload 不包含 `timings_ms`
