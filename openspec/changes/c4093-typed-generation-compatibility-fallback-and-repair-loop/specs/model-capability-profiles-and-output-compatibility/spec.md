# model-capability-profiles-and-output-compatibility 规范增量

## ADDED Requirements

### Requirement: Generation Requests MUST Run Compatibility Preflight Before Model Execution
系统 MUST 在真正调用模型前执行 compatibility preflight，而不是等请求进入生成链路后才发现模型、schema 或上下文不兼容。

#### Scenario: 某次结构化生成请求进入执行前
- **WHEN** 系统准备执行一个 typed generation request
- **THEN** 系统 SHALL 检查 model capability、output contract、schema complexity 与最小输入是否兼容
- **AND** SHALL 将结果归类为 hard block、soft warning 或 fallback-eligible

### Requirement: Model Capability Profiles MUST Explain Compatibility Boundaries
系统 MUST 用稳定的 model capability profile 表达结构化输出、长上下文、稳定性和限制边界，而不是只暴露一个模型名称列表。

#### Scenario: 用户或系统选择一个模型
- **WHEN** 某个 generation type 需要评估模型可用性
- **THEN** 系统 SHALL 能基于 capability profile 判断其推荐程度与已知限制
- **AND** SHALL 能解释该模型为何适合或不适合当前输出 contract
