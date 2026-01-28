# search-engine Specification

## Purpose
TBD - created by archiving change add-search-engine. Update Purpose after archive.
## Requirements
### Requirement: Search Engine Integration

系统 **MUST** 提供与外部搜索引擎集成的能力，支持 Web、Scholar、Docs 三种搜索模式，返回真实搜索结果。

#### Scenario: Web 模式返回真实搜索结果

- **WHEN** 用户调用搜索 API 并指定 mode=web
- **THEN** 系统调用配置的搜索引擎（如 SearXNG）获取结果
- **AND** 返回包含 title、url、snippet 字段的搜索结果列表

#### Scenario: 搜索失败时快速报错

- **WHEN** 搜索引擎 API 调用失败（网络错误、超时等）
- **THEN** 系统抛出 RuntimeError 而非静默返回空列表
- **AND** 前端显示错误提示信息

#### Scenario: 搜索结果缓存

- **WHEN** 用户执行相同的搜索查询（query + category）
- **AND** 缓存未过期
- **THEN** 系统从缓存返回结果
- **AND** 不调用外部 API

### Requirement: Search Provider Abstraction

系统 **MUST** 提供搜索提供者抽象层，支持多种搜索引擎后端的灵活切换。

#### Scenario: 配置搜索提供者

- **WHEN** 管理员在配置文件中指定 SearXNG 实例地址
- **THEN** 系统使用该实例执行搜索
- **AND** 支持配置超时时间和缓存 TTL

#### Scenario: 搜索类别映射

- **WHEN** 用户请求 Scholar 模式搜索
- **THEN** 系统将请求映射到 SearXNG 的 science 类别
- **AND** 返回学术相关的搜索结果

### Requirement: 搜索结果摘要消息
系统 **MUST** 在搜索响应中返回由摘要生成流程产生的 message，用于描述搜索结果与下一步建议。

#### Scenario: 返回摘要消息
- **WHEN** 搜索摘要生成成功
- **THEN** 搜索响应的 message 字段包含摘要与下一步提示
- **AND** message 不使用占位或 TODO 文本

#### Scenario: 摘要生成失败
- **WHEN** 搜索摘要生成失败或不可用
- **THEN** 搜索响应的 message 字段为空字符串
- **AND** 仍返回真实的搜索结果列表
