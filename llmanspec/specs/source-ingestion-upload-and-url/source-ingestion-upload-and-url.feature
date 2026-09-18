# language: zh-CN
# capability: source-ingestion-upload-and-url
# purpose: 定义通过上传文件与 URL 创建来源的契约：格式支持、校验、异常语义、网页抓取安全与提取器策略。该规范强调输入错误可预测且安全默认值优先，避免在抓取路径引入 SSRF 风险。
# scope: apps/server/src/features/sources/, apps/server/src/shared/net/

功能: source-ingestion-upload-and-url

  @req:r285 @human
  场景: Upload endpoint returns created source on success
    - 上传成功 MUST 返回 201 与来源对象；失败语义区分 400/413/415/500（至少；413 对应超限拒绝，见 size-limit 条）。

  @req:r286 @human
  场景: Supported formats are parser-driven
    - 支持类型 MUST 由 parser 能力决定；无匹配 parser 的文件 MUST 返回 415 且不创建来源。

  @req:r287 @human
  场景: 上传端点必须保留受支持写作工具的 Markdown 语义
    - 对于标准 Markdown 上传，系统 MUST 在进入 `chunk / embed / store` 之前执行语义预处理，以兼容常见写作工具的 Markdown 扩展语法，并将可提取的文档元数据写入 source metadata。

  @req:r287 @human
  场景: 上传-obsidian-风格-wikilink-与嵌入引用时标准化为标准 Markdown
    - 上传的 Markdown 含 `[[page]]` 或 `[[page|alias]]` wikilink 时，系统 MUST 在 chunking 前将其转换为标准 Markdown 链接文本；含 `![[file]]` 或 `![[file|alias]]` 嵌入引用时 MUST 将其转换为可检索的文本引用。

  @req:r287 @human
  场景: 上传-markdown-时提取-frontmatter-到来源元数据
    - 上传的 Markdown 文件包含可解析的 YAML frontmatter 时，系统 MUST 将支持字段（`title`、`tags`、`aliases`、`date`）写入 `source.metadata.frontmatter`。

  @req:r288 @human
  场景: Core upload supports CSV sources
    - 系统的核心发行版 MUST 支持通过上传方式创建 CSV 来源：`.csv` 扩展名与 `text/csv` MIME MUST 被识别并由匹配 parser 处理。

  @req:r289 @human
  场景: CSV sources are chunked by rows to avoid oversized single chunks
    - 大 CSV 按行块切分为多个可索引 chunk 的行为 MUST 遵循 source-ingestion-core csv-parser-markdown-table（canonical：markdown-table 分块、csv_row_start/csv_row_end metadata、单元格转义），以避免单个超大 chunk 导致检索与引用不稳定。

  @req:r290 @human
  场景: Deterministic input errors do not create source rows
    - 空文件或无可索引内容等确定性输入错误 MUST 返回 400 且不创建来源。

  @req:r291 @human
  场景: Oversized uploads are rejected deterministically with 413
    - 当 HTTP guardrails 启用时，上传接口 MUST 对单次上传施加配置项 `upload_max_bytes` 限制；超过上限 MUST 返回 413，且 MUST 不创建来源记录。未配置时的默认值 MUST 来自 config schema。

  @req:r292 @human
  场景: URL from-source supports link and fetch modes
    - `from-url` MUST 支持 `link|fetch`，`link` 不抓网页正文，`fetch` 抓取并分块。

  @req:r293 @human
  场景: Fetch applies SSRF validation before network calls
    - `fetch` MUST 在请求前做 SSRF 校验（含逐跳重定向重验）并拒绝高风险目标；SSRF 策略 MUST 从配置解析 hostAllowlist/domainAllowlist/cidrAllowlist/allowlist_only，配置 allowlist_only 时非白名单主机 MUST 被拒绝；无配置时 MUST 回退默认姿态（拒绝私网与元数据 IP）。

  @req:r294 @human
  场景: Extractor preference, fallback, and retry
    - 上传/URL 抓取路径的提取器 fallback 与可诊断失败语义 MUST 遵循 web-extractor-plugins r332/r335（canonical）；出站 HTTP 代理合约见 architecture-core r_outbound_http。

  @req:r295 @human
  场景: Unsupported formats are rejected with actionable diagnostics
    - 当上传/URL 抓取的内容无匹配 parser（例如缺失对应插件）时，系统 MUST 返回 415 且 MUST 提供可机器读取的诊断信息（errorCode/message/details），其中 details MUST 包含恢复提示（例如需要安装/启用的 `parser-*` 插件 id）。

  @req:r296 @human
  场景: Extractor selection errors are diagnosable
    - fetch 模式显式指定 extractor 的尝试顺序与不可用时的 fallback/错误语义见 web-extractor-plugins r332/r335（canonical）；无论回退还是失败，系统 MUST 输出可诊断信息说明发生了什么与如何恢复。

  @req:r297 @human
  场景: Sources search MUST perform real web search
    - POST /sources/search MUST 调用 web search 引擎（SearXNG）返回真实 web 结果，MUST NOT 返回 notebook 内向量匹配作为 placeholder；搜索引擎不可用或调用失败时 MUST 返回 status='service_error' 且 message MUST 为用户可读中文文案，MUST NOT 伪装为 'no_results' 或返回空成功响应；'no_results' MUST 仅表示引擎正常应答且零命中。前端 MUST 将 service_error 呈现为可与「无命中」区分的错误态（含重试入口或重试指引），MUST NOT 将其渲染为普通空结果提示。

  @req:r298 @human
  场景: Dedup MUST be gated by config
    - sources 去重 MUST 受 config source_ingestion.dedup.enabled 门控，为 false 时 MUST 跳过 dedup 直接创建新 source
