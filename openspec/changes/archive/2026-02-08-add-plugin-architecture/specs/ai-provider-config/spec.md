## ADDED Requirements

### Requirement: Plugin-based Provider Extension
系统 SHALL 支持通过插件机制注册第三方 AI provider。插件 MUST 通过 Python entry_points 被自动发现。插件注册的 provider MUST 与内置 provider 使用相同的接口。

#### Scenario: 加载第三方 AI provider 插件
- **WHEN** 安装了实现 AIProviderPlugin 接口的第三方包
- **THEN** 系统启动时自动发现并注册该 provider，可在配置文件中引用

#### Scenario: 禁用插件 provider
- **WHEN** 在配置文件中将某个插件 provider 标记为 disabled
- **THEN** 该 provider 不被加载，不出现在可用 provider 列表中
