## ADDED Requirements

### Requirement: Generation preference selection
系统 MUST 在 Studio tools 与 Slides 配置中提供“生成倾向”选择，并在后续生成与重试中保持一致。

#### Scenario: 选择 speed 透传到 outputs 请求
- **WHEN** 用户在 Studio tools 中选择生成倾向为 `speed` 并触发一个非 SLIDES 的输出生成
- **THEN** 客户端对 outputs 生成接口的请求体包含 `preference = "speed"`

#### Scenario: 恢复默认时不透传 preference
- **WHEN** 用户将生成倾向恢复为默认（未设置）
- **THEN** 后续生成请求体中不包含 `preference`

### Requirement: Slides generation_config.preference propagation
系统 MUST 在创建/更新 slides draft 时将生成倾向持久化到 `generation_config.preference`，并在后续生成中复用。

#### Scenario: 创建 draft 时保存 preference
- **WHEN** 用户在 Slides 配置中选择 `quality` 并创建/保存 draft
- **THEN** draft 读取结果中的 `generation_config.preference` 为 `quality`

### Requirement: Tool config dialog affects generation prompt
系统 MUST 确保 Studio 工具“自定义参数”对话框中的选项会影响实际生成（至少影响最终发送给后端的 prompt 文本）。

#### Scenario: 数量/难度/主题会进入提示词
- **WHEN** 用户在工具配置中选择数量/难度并填写主题，然后点击生成
- **THEN** 系统发送的 prompt MUST 包含所选数量/难度/主题信息
