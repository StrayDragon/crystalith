## ADDED Requirements

### Requirement: Workspace language policy is explicit and switchable
Workspace MUST 定义明确的语言策略（默认语言与回退规则），并提供可发现的语言切换入口；用户选择 MUST 被持久化以避免每次刷新漂移。

#### Scenario: Default language follows a deterministic rule
- **WHEN** 用户首次访问 Workspace 且未设置语言偏好
- **THEN** 系统 SHALL 按确定性规则选择默认语言（例如跟随浏览器语言，否则回退到默认语言）

#### Scenario: User can switch language and the choice persists
- **WHEN** 用户在 Workspace 中切换语言
- **THEN** 系统 SHALL 立即在关键路径 UI 文案中生效
- **AND** 该选择 SHALL 在刷新后仍保持一致（持久化）
