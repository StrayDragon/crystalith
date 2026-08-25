# language: zh-CN
# capability: source-ingestion-upload-and-url
# purpose: 定义通过上传文件与 URL 创建来源的契约：格式支持、校验、异常语义、网页抓取安全与提取器策略。该规范强调输入错误可预测且安全默认值优先，避免在抓取路径引入 SSRF 风险。
# scope: src/, tests/

功能: source-ingestion-upload-and-url

  @req:r50 @human
  场景: Upload endpoint returns created source on success
    - 上传成功 MUST 返回 201 与来源对象；失败语义区分 400/415/500。

  @req:r108 @human
  场景: Supported formats are parser-driven
    - 支持类型 MUST 由 parser 能力决定；无匹配 parser 的文件 MUST 返回 415 且不创建来源。

  @req:r145 @human
  场景: 上传端点必须保留受支持写作工具的 Markdown 语义
    - 对于标准 Markdown 上传，系统 MUST 在进入 `chunk / embed / store` 之前执行语义预处理，以兼容常见写作工具的 Markdown 扩展语法，并将可提取的文档元数据写入 source metadata。

  @req:r180 @human
  场景: Core upload supports CSV sources
    - 系统的核心发行版 MUST 支持通过上传方式创建 CSV 来源：`.csv` 扩展名与 `text/csv` MIME MUST 被识别并由匹配 parser 处理。

  @req:r212 @human
  场景: CSV sources are chunked by rows to avoid oversized single chunks
    - 系统 MUST 将 CSV 内容按行块切分为多个可索引 chunks，以避免单个超大 chunk 导致检索与引用不稳定。

  @req:r239 @human
  场景: Deterministic input errors do not create source rows
    - 空文件或无可索引内容等确定性输入错误 MUST 返回 400 且不创建来源。

  @req:r_upload_size_limit @human
  场景: Oversized uploads are rejected deterministically with 413
    - 当 HTTP guardrails 启用时，上传接口 MUST 对单次上传施加配置项 `upload_max_bytes` 限制；超过上限 MUST 返回 413，且 MUST 不创建来源记录。未配置时的默认值 MUST 来自 config schema。

  @req:r269 @human
  场景: URL from-source supports link and fetch modes
    - `from-url` MUST 支持 `link|fetch`，`link` 不抓网页正文，`fetch` 抓取并分块。

  @req:r_ssrf @human
  场景: Fetch applies SSRF validation before network calls
    - `fetch` MUST 在请求前做 SSRF 校验（含逐跳重定向重验）并拒绝高风险目标；SSRF 策略 MUST 从配置解析 hostAllowlist/domainAllowlist/cidrAllowlist/allowlist_only；无配置时 MUST 回退默认姿态（拒绝私网与元数据 IP）。

  @req:r61 @human
  场景: Extractor preference, fallback, and retry
    - 系统 MUST 支持提取器指定、可控 fallback、可重试错误重试；出站 HTTP 代理合约见 architecture-core r_outbound_http。

  @req:r67 @human
  场景: Unsupported formats are rejected with actionable diagnostics
    - 当上传/URL 抓取的内容无匹配 parser（例如缺失对应插件）时，系统 MUST 返回 415 且 MUST 提供可机器读取的诊断信息（errorCode/message/details），其中 details MUST 包含恢复提示（例如需要安装/启用的 `parser-*` 插件 id）。

  @req:r72 @human
  场景: Extractor selection errors are diagnosable
    - 当用户在 fetch 模式显式指定某 extractor 但其不可用（未安装/禁用/依赖缺失/服务不可达）时，系统 MUST 返回稳定错误语义或按策略回退；无论哪种路径，系统 MUST 输出可诊断信息说明发生了什么与如何恢复。

  @req:sources-search-web @human
  场景: Sources search MUST perform real web search
    - POST /sources/search MUST 调用 web search 引擎（SearXNG）返回真实 web 结果，MUST NOT 返回 notebook 内向量匹配作为 placeholder

  @req:sources-dedup-config-gated @human
  场景: Dedup MUST be gated by config
    - sources 去重 MUST 受 config source_ingestion.dedup.enabled 门控，为 false 时 MUST 跳过 dedup 直接创建新 source

  @req:r50 @human
  场景: upload-success-returns-created-source
    - 必须成立：当 用户上传一个可解析且可索引的文件；那么 系统 SHALL 返回 201 与创建的来源对象
    当 用户上传一个可解析且可索引的文件
    那么 系统 SHALL 返回 201 与创建的来源对象

  @req:r108 @human
  场景: unsupported-format-is-rejected
    - 必须成立：当 用户上传一个无匹配 parser 的文件；那么 系统 SHALL 返回 415 且不创建来源
    当 用户上传一个无匹配 parser 的文件
    那么 系统 SHALL 返回 415 且不创建来源

  @req:r145 @human
  场景: 上传-obsidian-风格-wikilink-时进行标准化
    - 必须成立：当 用户上传一个 `.md` / `text/markdown` 文件，内容包含 `[[page]]` 或 `[[page|alias]]`；那么 系统 SHALL 将其转换为标准 Markdown 链接文本后再进行 chunking
    当 用户上传一个 `.md` / `text/markdown` 文件，内容包含 `[[page]]` 或 `[[page|alias]]`
    那么 系统 SHALL 将其转换为标准 Markdown 链接文本后再进行 chunking

  @req:r145 @human
  场景: 上传-obsidian-风格嵌入时转为文本引用
    - 必须成立：当 上传的 Markdown 文件包含 `![[file]]` 或 `![[file|alias]]`；那么 系统 SHALL 将其转换为可检索的文本引用
    当 上传的 Markdown 文件包含 `![[file]]` 或 `![[file|alias]]`
    那么 系统 SHALL 将其转换为可检索的文本引用

  @req:r145 @human
  场景: 上传-markdown-时提取-frontmatter-到来源元数据
    - 必须成立：当 上传的 Markdown 文件包含可解析的 YAML frontmatter；那么 系统 SHALL 将支持字段（`title`、`tags`、`aliases`、`date`）写入 `source.metadata.frontmatter`
    当 上传的 Markdown 文件包含可解析的 YAML frontmatter
    那么 系统 SHALL 将支持字段（`title`、`tags`、`aliases`、`date`）写入 `source.metadata.frontmatter`

  @req:r180 @human
  场景: uploading-a-csv-is-accepted
    - 必须成立：当 用户上传一个 `.csv` 文件（`text/csv` 或扩展名 `.csv`）；那么 系统 SHALL 选择匹配的 parser 解析该文件
    当 用户上传一个 `.csv` 文件（`text/csv` 或扩展名 `.csv`）
    那么 系统 SHALL 选择匹配的 parser 解析该文件

  @req:r212 @human
  场景: large-csv-produces-multiple-chunks
    - 必须成立：当 用户上传一个包含大量行的 CSV；那么 系统 SHALL 生成多个 chunk（每个 chunk 覆盖一段行范围）
    当 用户上传一个包含大量行的 CSV
    那么 系统 SHALL 生成多个 chunk（每个 chunk 覆盖一段行范围）

  @req:r239 @human
  场景: deterministic-input-error-does-not-create-source
    - 必须成立：当 用户上传空文件或无可索引内容的输入；那么 系统 SHALL 返回 400 且不创建来源
    当 用户上传空文件或无可索引内容的输入
    那么 系统 SHALL 返回 400 且不创建来源

  @req:r_upload_size_limit @human
  场景: upload-larger-than-max-bytes-returns-413-and-does-not-create
    - 必须成立：当 guardrails 启用且配置上限 10MB；那么 系统对 20MB 上传 SHALL 返回 413 且不创建来源
    当 guardrails 启用且配置上限 10MB
    那么 系统对 20MB 上传 SHALL 返回 413 且不创建来源

  @req:r_upload_size_limit @human
  场景: default-limit-applies-without-config
    - 必须成立：当 guardrails 启用且未配置上传上限；那么 系统对超过 config schema 默认上限的上传 SHALL 返回 413
    当 guardrails 启用且未配置上传上限
    那么 系统对超过 config schema 默认上限的上传 SHALL 返回 413

  @req:r269 @human
  场景: link-mode-does-not-fetch-content
    - 必须成立：当 用户使用 `from-url` 的 `link` 模式创建来源；那么 系统 SHALL 仅保存链接而不抓取网页正文
    当 用户使用 `from-url` 的 `link` 模式创建来源
    那么 系统 SHALL 仅保存链接而不抓取网页正文

  @req:r_ssrf @human
  场景: ssrf-validation-runs-before-fetch
    - 必须成立：当 用户使用 `fetch` 抓取一个高风险 URL（含重定向链）；那么 系统 SHALL 在网络请求前执行 SSRF 校验并拒绝不安全目标
    当 用户使用 `fetch` 抓取一个高风险 URL（含重定向链）
    那么 系统 SHALL 在网络请求前执行 SSRF 校验并拒绝不安全目标

  @req:r_ssrf @human
  场景: allowlist_only_blocks
    - 必须成立：假如 配置了 allowlist_only=true 且 hostAllowlist 含 trusted.com；当 用户从非白名单主机 fetch URL；那么 系统 SHALL 拒绝该 fetch
    假如 配置了 allowlist_only=true 且 hostAllowlist 含 trusted.com
    当 用户从非白名单主机 fetch URL
    那么 系统 SHALL 拒绝该 fetch

  @req:r61 @human
  场景: extractor-fallback-is-controlled
    - 必须成立：当 指定提取器失败且存在可控 fallback；那么 系统 SHALL 按策略回退并对可重试错误进行重试
    当 指定提取器失败且存在可控 fallback
    那么 系统 SHALL 按策略回退并对可重试错误进行重试

  @req:r67 @human
  场景: uploading-a-pdf-without-parser-plugin-yields-a-hint
    - 必须成立：当 用户上传一个 PDF 且当前环境未安装/未启用 PDF parser 插件；那么 系统 SHALL 返回 415
    当 用户上传一个 PDF 且当前环境未安装/未启用 PDF parser 插件
    那么 系统 SHALL 返回 415

  @req:r72 @human
  场景: preferred-extractor-unavailable-is-explained
    - 必须成立：当 用户指定 `preferredExtractor=X` 但 X 不可用；那么 系统 SHALL 返回明确的不可用原因（或在回退后返回回退链路的诊断信息）
    当 用户指定 `preferredExtractor=X` 但 X 不可用
    那么 系统 SHALL 返回明确的不可用原因（或在回退后返回回退链路的诊断信息）

  @req:sources-search-web @human
  场景: client-searches
    - 必须成立：假如 客户端请求 /sources/search 带查询词；当 搜索执行；那么 系统 SHALL 返回 web search 结果而非 notebook 内向量匹配
    假如 客户端请求 /sources/search 带查询词
    当 搜索执行
    那么 系统 SHALL 返回 web search 结果而非 notebook 内向量匹配

  @req:sources-dedup-config-gated @human
  场景: dedup-disabled
    - 必须成立：假如 config dedup.enabled=false；当 上传重复内容 source；那么 系统 SHALL 跳过 dedup 直接创建新 source
    假如 config dedup.enabled=false
    当 上传重复内容 source
    那么 系统 SHALL 跳过 dedup 直接创建新 source
