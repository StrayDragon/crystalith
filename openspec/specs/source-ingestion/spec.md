# source-ingestion Specification

## Purpose
TBD - created by archiving change add-research-workspace. Update Purpose after archive.
## Requirements
### Requirement: 文档上传与状态跟踪
系统 SHALL 允许用户将 txt/markdown 文档上传到 Notebook 并跟踪处理状态。

#### Scenario: 上传文档
- **WHEN** 用户向 Notebook 上传 txt/markdown 文件
- **THEN** 来源显示为“处理中”，成功后变为“已就绪”

### Requirement: 文档索引
系统 SHALL 对文档进行分块与向量化，并建立可检索索引。

#### Scenario: 文档完成索引
- **WHEN** 文档处理成功
- **THEN** 其分块可被问答检索到

### Requirement: 文档移除
系统 SHALL 允许用户删除文档并移除其索引分块。

#### Scenario: 删除文档
- **WHEN** 用户从 Notebook 删除文档
- **THEN** 该文档的分块不再出现在检索结果中

### Requirement: 网页内容提取系统

系统 **MUST** 能够从 URL 下载并解析网页内容，支持多种提取器和自动降级。

#### Scenario: 获取模式添加来源

- **WHEN** 用户选择"获取内容"模式添加 URL
- **THEN** 系统使用配置的提取器下载网页内容
- **AND** 创建完整的来源记录和分块

#### Scenario: 提取器自动降级

- **WHEN** 首选提取器失败
- **THEN** 系统自动尝试下一个可用提取器
- **AND** 直到成功或所有提取器都失败

#### Scenario: 用户选择提取器

- **WHEN** 用户在前端选择特定提取器
- **THEN** 系统使用指定的提取器进行内容提取
- **AND** 如果指定提取器不可用则返回错误

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

### Requirement: 失败来源重嵌入
系统 MUST 支持对索引失败的来源触发重嵌入，以重新进行分块与向量化。

#### Scenario: 触发重嵌入
- **WHEN** 用户在来源列表中点击“重新嵌入”
- **THEN** 系统重新启动该来源的索引流程
- **AND** 来源状态切换为“处理中”

#### Scenario: 非失败来源不可重嵌入
- **WHEN** 来源未处于失败状态
- **THEN** 系统不展示重嵌入入口
- **AND** 不允许触发重嵌入
