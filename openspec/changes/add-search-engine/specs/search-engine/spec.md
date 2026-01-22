## ADDED Requirements

### Requirement: Search Engine Integration

系统必须（SHALL）提供与外部搜索引擎集成的能力，支持 Web、Scholar、Docs 三种搜索模式，返回真实搜索结果。

#### Scenario: Web 模式返回真实搜索结果

- **WHEN** 用户调用搜索 API 并指定 mode=web
- **THEN** 系统返回至少 5 条真实搜索结果
- **AND** 每条结果包含 title、url、snippet 字段

#### Scenario: 搜索失败时的错误处理

- **WHEN** 搜索引擎 API 调用失败（网络错误、配额耗尽等）
- **THEN** 系统返回友好的错误提示
- **AND** 记录错误日志以便排查

#### Scenario: 搜索结果缓存

- **WHEN** 用户执行相同的搜索查询（query + mode）
- **AND** 缓存未过期
- **THEN** 系统从缓存返回结果
- **AND** 不调用外部 API

### Requirement: Search Provider Abstraction

系统必须（SHALL）提供搜索提供者抽象层，支持多种搜索引擎后端的灵活切换。

#### Scenario: 配置切换搜索提供者

- **WHEN** 管理员在配置文件中指定不同的搜索提供者
- **THEN** 系统使用指定的提供者执行搜索
- **AND** 无需修改代码

#### Scenario: Fallback 机制

- **WHEN** 首选搜索提供者不可用
- **AND** 配置了 fallback 提供者
- **THEN** 系统自动切换到 fallback 提供者
