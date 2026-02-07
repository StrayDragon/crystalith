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

### Requirement: 嵌入批处理
系统 MUST 在文档索引时按可配置的 batch_size 分批调用嵌入 API，避免单次调用超限。

#### Scenario: 大文档分批嵌入
- **WHEN** 文档分块数超过 batch_size（默认 100）
- **THEN** 系统按 batch_size 分片依次调用嵌入 API
- **AND** 所有分片完成后合并结果
- **AND** 单片失败不影响其他片的结果

#### Scenario: 小文档单批嵌入
- **WHEN** 文档分块数不超过 batch_size
- **THEN** 系统以单次调用完成嵌入
- **AND** 行为与未启用批处理时一致

### Requirement: 嵌入内容缓存
系统 MUST 对嵌入结果按内容哈希缓存，避免相同内容重复调用嵌入 API。

#### Scenario: 缓存命中
- **WHEN** 待嵌入文本的 SHA256 哈希在缓存中存在
- **THEN** 系统直接返回缓存的嵌入向量
- **AND** 不调用嵌入 API

#### Scenario: 缓存未命中
- **WHEN** 待嵌入文本的 SHA256 哈希在缓存中不存在
- **THEN** 系统调用嵌入 API 获取结果
- **AND** 将结果存入缓存

### Requirement: Source 解析异步化
系统 MUST 将同步的文档解析操作移至线程池执行，不阻塞异步事件循环。

#### Scenario: 大文档解析不阻塞
- **WHEN** 用户上传大 PDF/HTML 文档
- **THEN** 系统在线程池中执行解析
- **AND** 同时接受的其他 API 请求不因解析阻塞而延迟

### Requirement: Batch Source Operations
系统 SHALL 支持批量 source 操作，包括批量删除和批量 re-embed。批量操作 MUST 通过专用 API 端点提供。

#### Scenario: 批量删除 source
- **WHEN** 请求 DELETE /v1/notebooks/{id}/sources/batch，body 包含 source_ids 列表
- **THEN** 所有指定的 source 及其 chunks 被删除，向量存储中对应数据被清理

#### Scenario: 批量 re-embed
- **WHEN** 请求 POST /v1/notebooks/{id}/sources/batch/re-embed，body 包含 source_ids 列表
- **THEN** 所有指定 source 的 chunks 重新进行嵌入计算

### Requirement: Source Tagging
系统 SHALL 支持为 source 添加标签。每个 notebook 下的标签 MUST 唯一。Source 列表 SHALL 支持按标签筛选。

#### Scenario: 为 source 添加标签
- **WHEN** 为一个 source 添加标签 "论文"
- **THEN** source 关联该标签，按 "论文" 标签筛选时该 source 出现在结果中

#### Scenario: 按标签筛选
- **WHEN** 请求 source 列表并指定 tag 筛选参数
- **THEN** 仅返回包含该标签的 source
