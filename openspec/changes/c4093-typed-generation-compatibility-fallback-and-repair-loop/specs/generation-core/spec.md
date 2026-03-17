# generation-core 规范增量

## ADDED Requirements

### Requirement: Generation Core MUST Execute a Governance Loop Around Model Execution
系统 MUST 在模型执行前后运行统一 governance loop，而不是只把生成视为一次黑盒调用。

#### Scenario: 系统处理一次 typed generation request
- **WHEN** 某个结构化生成请求进入 generation core
- **THEN** 系统 SHALL 在模型执行前运行 compatibility preflight
- **AND** SHALL 在失败时基于 retry bucket 决定 retry 或 fallback
- **AND** SHALL 在结果不完整但可修时进入 repair loop
