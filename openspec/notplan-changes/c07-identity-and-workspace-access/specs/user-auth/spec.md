## ADDED Requirements

### Requirement: User Registration
系统 SHALL 支持邮箱+密码的用户注册。密码 MUST 使用 bcrypt 哈希存储。邮箱 MUST 唯一。

#### Scenario: 成功注册
- **WHEN** 用户提供有效的邮箱和密码进行注册
- **THEN** 系统创建用户账号并返回成功响应

#### Scenario: 重复邮箱注册
- **WHEN** 用户使用已注册的邮箱进行注册
- **THEN** 系统返回 409 Conflict 错误

### Requirement: User Authentication
系统 SHALL 支持邮箱+密码登录，成功后返回 JWT access token 和 refresh token。

#### Scenario: 成功登录
- **WHEN** 用户提供正确的邮箱和密码
- **THEN** 系统返回 JWT access token（短有效期）和 refresh token（长有效期）

#### Scenario: 错误凭据
- **WHEN** 用户提供错误的密码
- **THEN** 系统返回 401 Unauthorized

#### Scenario: Token 刷新
- **WHEN** access token 过期，使用有效的 refresh token 请求刷新
- **THEN** 系统返回新的 access token

### Requirement: API Authentication Middleware
系统 SHALL 对所有受保护的 API 端点进行 JWT 认证。未认证请求 MUST 返回 401。系统 SHALL 支持匿名模式（通过配置禁用认证）。

#### Scenario: 受保护端点需要认证
- **WHEN** 未携带 Authorization header 的请求访问 /v1/notebooks
- **THEN** 返回 401 Unauthorized

#### Scenario: 匿名模式
- **WHEN** 配置文件中 auth.enabled=false
- **THEN** 所有 API 端点无需认证即可访问

### Requirement: User Data Isolation
系统 SHALL 确保用户只能访问自己创建的或被共享的 notebook。

#### Scenario: 数据隔离
- **WHEN** 用户 A 请求 notebook 列表
- **THEN** 仅返回用户 A 创建的和被分享给用户 A 的 notebook
