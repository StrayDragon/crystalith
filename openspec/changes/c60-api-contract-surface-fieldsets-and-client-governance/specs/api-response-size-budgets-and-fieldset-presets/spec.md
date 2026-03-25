# api-response-size-budgets-and-fieldset-presets 规范增量

## ADDED Requirements

### Requirement: Read-heavy Endpoints MUST Have Fieldset-specific Size Budgets
系统 MUST 为高频读取 endpoint 定义 fieldset-specific response size budgets，让字段裁剪成为可回归的性能契约。

#### Scenario: 热门列表或 bootstrap 接口返回数据
- **WHEN** 系统返回列表、详情或 bootstrap 等高频读取响应
- **THEN** 该响应 SHALL 归属于对应 fieldset budget
- **AND** 系统 SHALL 能判断该响应是否超出预算范围

### Requirement: Responses MUST Expose a Serialized-size Signal
系统 MUST 暴露轻量的响应体大小信号，便于前端与诊断工具解释“为什么这次变慢了”。

#### Scenario: 客户端或诊断工具查看一次响应
- **WHEN** 某个 endpoint 完成序列化并返回结果
- **THEN** 系统 SHALL 通过 `meta.bytes`、header 或等价机制暴露稳定的 bytes 信号
- **AND** 该信号 SHALL 可用于性能诊断与回归比较

### Requirement: Budget Enforcement MUST Support Warn-before-gate Rollout
系统 MUST 支持先告警再强制的预算治理路径，避免在预算尚未校准时直接阻断所有接口演进。

#### Scenario: 新预算首次接入回归检查
- **WHEN** 某个 endpoint 首次接入 response size budget
- **THEN** 系统 SHALL 支持先以 warn 方式报告超预算
- **AND** 在预算稳定后 SHALL 能升级为 gate
