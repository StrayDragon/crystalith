# generation-core Specification (Delta)

## ADDED Requirements

### Requirement: Tool output types require a corresponding OutputTypePlugin
对于 FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING 等“工具输出类型”，系统 MUST 要求存在可用的 `OutputTypePlugin` 才能生成结构化输出；当插件缺失/禁用/加载失败时，生成请求 MUST 失败并返回可执行的恢复提示。

错误响应 MUST 使用统一错误信封（`error_code`, `message`, `details?`, `retry_after?`），且：
- HTTP status SHOULD 为 409（或等价“能力不可用”语义）
- `details` MUST 包含 `output_type` 与推荐的 `required_plugin_id`（例如 `output-faq`）
- `message` MUST 可直接面向用户显示

#### Scenario: Missing plugin blocks tool output generation
- **WHEN** 客户端请求生成某工具输出类型但服务器未安装/未启用对应插件
- **THEN** 系统 SHALL 返回失败响应
- **AND** 响应 SHALL 包含可执行的 recovery hint（安装/启用对应插件）
