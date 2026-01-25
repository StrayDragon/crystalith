## ADDED Requirements

### Requirement: 分层网页内容提取

系统 SHALL 支持多种网页内容提取方式，并按配置的优先级自动选择和降级。

#### Scenario: 使用本地提取器成功提取

- **WHEN** 用户请求从 URL 导入内容
- **AND** 本地提取器（trafilatura）已启用
- **THEN** 系统首先尝试使用本地提取器
- **AND** 提取成功时返回 Markdown 格式的正文内容
- **AND** 元数据中记录 `extractor: "trafilatura"`

#### Scenario: 本地提取失败降级到外部 API

- **WHEN** 本地提取器返回空内容或抛出异常
- **AND** 外部 API 提取器已启用
- **THEN** 系统自动尝试使用配置的外部 API（如 Jina Reader）
- **AND** 成功时元数据中记录实际使用的提取器

#### Scenario: 降级到浏览器渲染

- **WHEN** 本地提取和外部 API 均失败
- **AND** Browserless 服务已配置且可用
- **THEN** 系统使用浏览器渲染页面后再提取
- **AND** 元数据中记录 `extractor: "browserless"`

#### Scenario: 所有提取方式均失败

- **WHEN** 所有配置的提取方式均失败
- **THEN** 系统返回明确的错误信息
- **AND** 错误信息包含尝试过的提取方式和各自的失败原因

### Requirement: Jina Reader API 集成

系统 SHALL 支持通过 Jina Reader API 提取网页内容。

#### Scenario: 使用 Jina Reader 提取内容

- **WHEN** 配置启用 Jina Reader API
- **AND** 系统需要使用外部 API 提取
- **THEN** 系统向 `r.jina.ai/{url}` 发送请求
- **AND** 解析返回的 JSON 响应获取 Markdown 内容
- **AND** 提取标题、内容等字段

#### Scenario: Jina Reader 请求超时

- **WHEN** Jina Reader API 请求超过配置的超时时间
- **THEN** 系统记录超时错误
- **AND** 继续尝试下一个降级选项

### Requirement: Firecrawl API 集成

系统 SHALL 支持通过 Firecrawl API 提取网页内容。

#### Scenario: 使用 Firecrawl 提取内容

- **WHEN** 配置启用 Firecrawl API 并提供有效 API Key
- **AND** 系统需要使用 Firecrawl 提取
- **THEN** 系统向 Firecrawl API 发送 scrape 请求
- **AND** 解析返回的 Markdown 内容

#### Scenario: Firecrawl API Key 无效

- **WHEN** Firecrawl API 返回认证错误
- **THEN** 系统记录 API Key 无效的错误
- **AND** 继续尝试下一个降级选项

### Requirement: Browserless 浏览器渲染集成

系统 SHALL 支持通过 Browserless 服务渲染 JavaScript 页面。

#### Scenario: 使用 Browserless 渲染页面

- **WHEN** 配置启用 Browserless 服务
- **AND** 系统需要使用浏览器渲染
- **THEN** 系统通过 Playwright CDP 连接到 Browserless
- **AND** 加载页面并等待网络空闲
- **AND** 获取渲染后的 HTML 内容
- **AND** 使用本地提取器处理渲染后的 HTML

#### Scenario: Browserless 服务不可用

- **WHEN** 无法连接到配置的 Browserless 端点
- **THEN** 系统记录连接失败错误
- **AND** 跳过浏览器渲染步骤

### Requirement: 提取结果元数据

系统 SHALL 在提取的来源中记录提取相关的元数据。

#### Scenario: 记录提取元数据

- **WHEN** 网页内容提取成功
- **THEN** Source 的 metadata 包含以下字段：
  - `extractor`: 使用的提取器名称
  - `extraction_time_ms`: 提取耗时（毫秒）
  - `original_url`: 原始 URL
  - `page_title`: 页面标题（如果提取到）
  - `page_author`: 页面作者（如果提取到）
  - `page_date`: 发布日期（如果提取到）

## MODIFIED Requirements

### Requirement: 文档上传与状态跟踪

系统 SHALL 允许用户将 txt/markdown 文档上传到 Notebook 并跟踪处理状态，同时支持从 URL 导入网页内容。

#### Scenario: 上传文档

- **WHEN** 用户向 Notebook 上传 txt/markdown 文件
- **THEN** 来源显示为"处理中"，成功后变为"已就绪"

#### Scenario: 从 URL 导入全文

- **WHEN** 用户请求从 URL 导入全文内容
- **THEN** 系统使用配置的提取策略获取网页内容
- **AND** 来源显示为"处理中"
- **AND** 提取成功后来源变为"已就绪"
- **AND** 元数据中包含提取方式和原始 URL
