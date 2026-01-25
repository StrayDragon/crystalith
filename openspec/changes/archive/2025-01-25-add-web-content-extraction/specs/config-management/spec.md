## ADDED Requirements

### Requirement: 网页内容提取配置

系统 SHALL 支持通过 YAML 配置文件配置网页内容提取的策略和参数。

#### Scenario: 配置本地提取器

- **WHEN** 用户在 `web_extraction.local` 中配置参数
- **THEN** 系统使用指定的本地提取引擎（trafilatura/beautifulsoup）
- **AND** 应用配置的超时和选项参数

#### Scenario: 配置外部 API 提取器

- **WHEN** 用户在 `web_extraction.api` 中启用并配置 API 提供商
- **THEN** 系统可使用配置的外部 API 进行内容提取
- **AND** 对于需要 API Key 的服务，验证 Key 已配置

#### Scenario: 配置 Browserless 服务

- **WHEN** 用户在 `web_extraction.browserless` 中配置端点和令牌
- **THEN** 系统可连接到指定的 Browserless 服务
- **AND** 使用配置的超时参数

#### Scenario: 配置降级策略

- **WHEN** 用户在 `web_extraction.fallback` 中配置降级顺序
- **THEN** 系统按指定顺序尝试各提取方式
- **AND** 仅尝试已启用的提取器

#### Scenario: 使用默认配置

- **WHEN** 用户未配置 `web_extraction` 节
- **THEN** 系统使用默认配置：
  - 本地提取器启用（trafilatura）
  - 外部 API 禁用
  - Browserless 禁用
  - 降级启用，顺序为 local → api → browserless
