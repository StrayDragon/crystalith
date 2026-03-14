# source-ingestion-upload-and-url Specification

## Purpose

定义通过上传文件与 URL 创建来源的契约：格式支持、校验、异常语义、网页抓取安全与提取器策略。该规范强调输入错误可预测且安全默认值优先，避免在抓取路径引入 SSRF 风险。

## Non-goals

- 不定义来源列表/标签管理
- 不定义前端 Sources 面板布局

## Requirements

### Requirement: Upload endpoint returns created source on success
上传成功 MUST 返回 201 与来源对象；失败语义区分 400/415/500。

#### Scenario: Upload success returns created source
- **WHEN** 用户上传一个可解析且可索引的文件
- **THEN** 系统 SHALL 返回 201 与创建的来源对象

### Requirement: Supported formats are parser-driven
支持类型 MUST 由 parser 能力决定；无匹配 parser 的文件 MUST 返回 415 且不创建来源。

#### Scenario: Unsupported format is rejected
- **WHEN** 用户上传一个无匹配 parser 的文件
- **THEN** 系统 SHALL 返回 415 且不创建来源

### Requirement: 上传端点必须保留受支持写作工具的 Markdown 语义
对于标准 Markdown 上传，系统 MUST 在进入 `chunk / embed / store` 之前执行语义预处理，以兼容常见写作工具的 Markdown 扩展语法，并将可提取的文档元数据写入 source metadata。

#### Scenario: 上传 Obsidian 风格 wikilink 时进行标准化
- **WHEN** 用户上传一个 `.md` / `text/markdown` 文件，内容包含 `[[page]]` 或 `[[page|alias]]`
- **THEN** 系统 SHALL 将其转换为标准 Markdown 链接文本后再进行 chunking
- **AND** 上传后的来源内容 SHALL 保留可检索的链接语义

#### Scenario: 上传 Obsidian 风格嵌入时转为文本引用
- **WHEN** 上传的 Markdown 文件包含 `![[file]]` 或 `![[file|alias]]`
- **THEN** 系统 SHALL 将其转换为可检索的文本引用
- **AND** v1 SHALL NOT 要求展开嵌入内容本体

#### Scenario: 上传 Markdown 时提取 frontmatter 到来源元数据
- **WHEN** 上传的 Markdown 文件包含可解析的 YAML frontmatter
- **THEN** 系统 SHALL 将支持字段（`title`、`tags`、`aliases`、`date`）写入 `source.metadata.frontmatter`
- **AND** SHALL 不影响正常的 `source ready` 语义

### Requirement: Core upload supports CSV sources
系统的核心发行版 MUST 支持通过上传方式创建 CSV 来源：`.csv` 扩展名与 `text/csv` MIME MUST 被识别并由匹配 parser 处理。

#### Scenario: Uploading a CSV is accepted
- **WHEN** 用户上传一个 `.csv` 文件（`text/csv` 或扩展名 `.csv`）
- **THEN** 系统 SHALL 选择匹配的 parser 解析该文件
- **AND** 上传成功时 SHALL 返回 201 与创建的来源对象

### Requirement: CSV sources are chunked by rows to avoid oversized single chunks
系统 MUST 将 CSV 内容按行块切分为多个可索引 chunks，以避免单个超大 chunk 导致检索与引用不稳定。

#### Scenario: Large CSV produces multiple chunks
- **WHEN** 用户上传一个包含大量行的 CSV
- **THEN** 系统 SHALL 生成多个 chunk（每个 chunk 覆盖一段行范围）
- **AND** chunks SHALL 保持可检索与可引用（符合 ready 语义）

### Requirement: Deterministic input errors do not create source rows
空文件或无可索引内容等确定性输入错误 MUST 返回 400 且不创建来源。

#### Scenario: Deterministic input error does not create source
- **WHEN** 用户上传空文件或无可索引内容的输入
- **THEN** 系统 SHALL 返回 400 且不创建来源

### Requirement: URL from-source supports link and fetch modes
`from-url` MUST 支持 `link|fetch`，`link` 不抓网页正文，`fetch` 抓取并分块。

#### Scenario: Link mode does not fetch content
- **WHEN** 用户使用 `from-url` 的 `link` 模式创建来源
- **THEN** 系统 SHALL 仅保存链接而不抓取网页正文

### Requirement: Fetch applies SSRF validation before network calls
`fetch` MUST 在请求前做 SSRF 校验并拒绝高风险目标（含逐跳重定向重验）。

#### Scenario: SSRF validation runs before fetch
- **WHEN** 用户使用 `fetch` 抓取一个高风险 URL（含重定向链）
- **THEN** 系统 SHALL 在网络请求前执行 SSRF 校验并拒绝不安全目标

### Requirement: Extractor preference, fallback, retry, and proxy are scoped
系统 MUST 支持提取器指定、可控 fallback、可重试错误重试、按提取器粒度代理配置。

#### Scenario: Extractor fallback is controlled
- **WHEN** 指定提取器失败且存在可控 fallback
- **THEN** 系统 SHALL 按策略回退并对可重试错误进行重试，同时保持代理配置按提取器粒度生效

### Requirement: Unsupported formats are rejected with actionable diagnostics
当上传/URL 抓取的内容无匹配 parser（例如缺失对应插件）时，系统 MUST 返回 415 且 MUST 提供可机器读取的诊断信息（error_code/message/details），其中 details MUST 包含恢复提示（例如需要安装/启用的 `parser-*` 插件 id）。

#### Scenario: Uploading a PDF without parser plugin yields a hint
- **WHEN** 用户上传一个 PDF 且当前环境未安装/未启用 PDF parser 插件
- **THEN** 系统 SHALL 返回 415
- **AND** 响应 details SHALL 指出缺失的插件能力与恢复步骤（安装/启用对应插件）

### Requirement: Extractor selection errors are diagnosable
当用户在 fetch 模式显式指定某 extractor 但其不可用（未安装/禁用/依赖缺失/服务不可达）时，系统 MUST 返回稳定错误语义或按策略回退；无论哪种路径，系统 MUST 输出可诊断信息说明发生了什么与如何恢复。

#### Scenario: Preferred extractor unavailable is explained
- **WHEN** 用户指定 `preferred_extractor=X` 但 X 不可用
- **THEN** 系统 SHALL 返回明确的不可用原因（或在回退后返回回退链路的诊断信息）
- **AND** SHALL 提供可执行的恢复提示（启用插件/配置 endpoint/API key/稍后重试）
