## MODIFIED Requirements

### Requirement: 从 URL 获取网页内容

系统 **MUST** 能够从 URL 下载并解析网页内容，支持合理的请求头伪装和可选的代理配置。

#### Scenario: 获取模式添加来源（原有）

- **WHEN** 用户选择"获取内容"模式添加 URL
- **THEN** 系统下载网页内容并使用 HTML 解析器解析
- **AND** 创建完整的来源记录和分块

#### Scenario: 带浏览器伪装的请求

- **WHEN** 系统发起网页下载请求
- **THEN** 请求包含合理的 User-Agent、Accept 等 HTTP 头
- **AND** 请求模拟常见浏览器的行为

#### Scenario: 请求失败重试

- **WHEN** 网页下载请求失败
- **THEN** 系统最多重试 2 次
- **AND** 每次重试间隔 1 秒

#### Scenario: 使用代理获取内容

- **WHEN** 配置文件中启用了 HTTP 代理
- **THEN** 系统通过配置的代理服务器发起请求
- **AND** 代理配置错误时返回明确的错误信息

## ADDED Requirements

### Requirement: HTTP 代理配置

系统 **MUST** 支持可选的 HTTP 代理配置用于网页内容获取，支持 HTTP/HTTPS/SOCKS5 协议。

#### Scenario: 代理配置默认禁用

- **WHEN** 配置文件未指定代理配置或 `http.proxy.enabled: false`
- **THEN** 系统直接发起 HTTP 请求，不使用代理

#### Scenario: 启用 HTTP 代理

- **WHEN** 配置文件指定 `http.proxy.enabled: true` 和 `http.proxy.http_url`
- **THEN** 所有 URL 内容获取请求通过指定 HTTP 代理发送

#### Scenario: 启用 SOCKS5 代理

- **WHEN** 配置文件指定 `http.proxy.enabled: true` 和 `http.proxy.socks5_url`
- **THEN** 优先使用 SOCKS5 代理发送请求

#### Scenario: 排除特定域名

- **WHEN** 请求的域名在 `http.proxy.no_proxy` 列表中
- **THEN** 该请求直接发送，不经过代理

#### Scenario: 代理配置验证

- **WHEN** 代理 URL 格式无效
- **THEN** 系统启动时报告配置错误
