# language: zh-CN
# capability: source-ingestion-upload-and-url
# purpose: 定义通过上传文件与 URL 创建来源的契约：格式支持、校验、异常语义、网页抓取安全与提取器策略。该规范强调输入错误可预测且安全默认值优先，避免在抓取路径引入 SSRF 风险。
# scope: apps/server/src/features/sources/, apps/server/src/shared/net/

功能: source-ingestion-upload-and-url

  @req:r285
  规则: Upload endpoint returns created source on success
    上传成功 MUST 返回 201 与来源对象；失败语义区分 400/413/415/500（至少；413 对应超限拒绝，见 size-limit 条）。

    场景: upload-returns-201-with-source
      假如 一个空白笔记本
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/sources"上传一个受支持的文本文件
      那么 响应状态码为201 且返回含 id 与 status 的来源对象
      而且 轮询该来源直至状态为 ready（见 sources/ingest.test.ts upload 用例）
  @req:r286
  规则: Supported formats are parser-driven
    支持类型 MUST 由 parser 能力决定；无匹配 parser 的文件 MUST 返回 415 且不创建来源。

    场景: supported-formats-parser-driven
      假如 已注册 parser 各自声明可处理的 MIME 与扩展名
      当 查询 /v2/sources/parsers 并上传 .md 与 .csv 文件（见 sources/c117-upload-contract.test.ts）
      那么 清单按 parser 能力给出 mimeTypes 与 extensions
      而且 上传按能力路由到匹配 parser 并在来源上记录 parserType
  @req:r287
  规则: 上传端点必须保留受支持写作工具的 Markdown 语义
    对于标准 Markdown 上传，系统 MUST 在进入 `chunk / embed / store` 之前执行语义预处理，以兼容常见写作工具的 Markdown 扩展语法，并将可提取的文档元数据写入 source metadata。
  
    场景: markdown-semantic-preprocessing-before-chunking
      假如 ingestion 集成环境就绪
      当 上传含 wikilink 与 frontmatter 的 markdown
      那么 预处理在 chunk 之前执行且普通 markdown 文本逐字节零扰动

@req:r464

  规则: 上传-obsidian-风格-wikilink-与嵌入引用时标准化为标准 Markdown
    上传的 Markdown 含 `[[page]]` 或 `[[page|alias]]` wikilink 时，系统 MUST 在 chunking 前将其转换为标准 Markdown 链接文本；含 `![[file]]` 或 `![[file|alias]]` 嵌入引用时 MUST 将其转换为可检索的文本引用。
  
    场景: wikilinks-and-embeds-normalized
      假如 ingestion 集成环境就绪
      当 上传含 [[page|alias]]、[[page]]、![[img.png]]、![[note]] 的 markdown
      那么 分块文本中分别为 [alias](page)、[page](page)、![img.png](img.png)（图片嵌入）与 [note](note)（文本引用）

@req:r465

  规则: 上传-markdown-时提取-frontmatter-到来源元数据
    上传的 Markdown 文件包含可解析的 YAML frontmatter 时，系统 MUST 将支持字段（`title`、`tags`、`aliases`、`date`）写入 `source.metadata.frontmatter`。
  
    场景: frontmatter-extracted-to-metadata
      假如 ingestion 集成环境就绪
      当 上传带 YAML frontmatter（title/tags/aliases/date）的 markdown
      那么 支持字段写入 source.metadata.frontmatter 且 frontmatter 块不进入任何分块文本

@req:r288
  规则: Core upload supports CSV sources
    系统的核心发行版 MUST 支持通过上传方式创建 CSV 来源：`.csv` 扩展名与 `text/csv` MIME MUST 被识别并由匹配 parser 处理。

    场景: csv-upload-parser-contract
      假如 一个空白笔记本
      当 分别以 text/csv MIME 与缺失 MIME 的 .csv 扩展名上传 CSV（见 sources/c117-upload-contract.test.ts）
      那么 上传被 CSV parser 处理（parserType=csv）并落库
      而且 无 MIME 时按 .csv 扩展名识别并同样标记 ready
  @req:r289
  规则: CSV sources are chunked by rows to avoid oversized single chunks
    大 CSV 按行块切分为多个可索引 chunk 的行为 MUST 遵循 source-ingestion-core csv-parser-markdown-table（canonical：markdown-table 分块、csv_row_start/csv_row_end metadata、单元格转义），以避免单个超大 chunk 导致检索与引用不稳定。

    场景: csv-row-chunking
      假如 一个 120 行的 CSV 上传
      当 查看其分块与 chunk metadata（见 sources/c117-upload-contract.test.ts）
      那么 切分为 3 个 50 行 markdown-table 分块且各自自带表头
      而且 csv_row_start/csv_row_end 元数据 1 起始且连续
  @req:r290
  规则: Deterministic input errors do not create source rows
    空文件或无可索引内容等确定性输入错误 MUST 返回 400 且不创建来源。

    场景: empty-or-blank-upload-rejected-without-source-row
      假如 集成环境就绪且上传入口可用
      当 上传空 .txt 或纯空白 .txt 文件
      那么 响应状态码为 400 且 errorCode 为 INVALID_REQUEST
      而且 sources 表不残留任何来源行
  @req:r291
  规则: Oversized uploads are rejected deterministically with 413
    当 HTTP guardrails 启用时，上传接口 MUST 对单次上传施加配置项 `upload_max_bytes` 限制；超过上限 MUST 返回 413，且 MUST 不创建来源记录。未配置时的默认值 MUST 来自 config schema。

    场景: upload-max-bytes-413
      假如 config 将 upload_max_bytes 配置为小于上传体大小
      当 上传超限文件（见 sources/c117-upload-contract.test.ts）
      那么 返回 413 PAYLOAD_TOO_LARGE 且 details 含 maxBytes 与 uploadedBytes
      而且 不创建来源记录
  @req:r292
  规则: URL from-source supports link and fetch modes
    `from-url` MUST 支持 `link|fetch`，`link` 不抓网页正文，`fetch` 抓取并分块。

    场景: from-url-link-and-fetch-modes
      假如 一个空白笔记本
      当 分别以 mode=link 与 mode=fetch 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/sources/from-url"
      那么 link 模式不抓取网页正文仅登记链接来源
      而且 fetch 模式抓取页面正文并产出可检索分块
  @req:r293
  规则: Fetch applies SSRF validation before network calls
    `fetch` MUST 在请求前做 SSRF 校验（含逐跳重定向重验）并拒绝高风险目标；SSRF 策略 MUST 从配置解析 hostAllowlist/domainAllowlist/cidrAllowlist/allowlist_only，配置 allowlist_only 时非白名单主机 MUST 被拒绝；无配置时 MUST 回退默认姿态（拒绝私网与元数据 IP）。

    场景: fetch-ssrf-validation
      假如 fetch 目标为私网 IP 或元数据地址
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/sources/from-url"且 mode=fetch
      那么 请求在发起网络调用前被拒绝（见 net/url-safety.test.ts 与 net/fetch-with-redirect-guard.test.ts）
      而且 逐跳重定向落到私网目标同样被拦截
      而且 配置 allowlist_only 后非白名单主机被拒绝
  @req:r294
  规则: Extractor preference, fallback, and retry
    上传/URL 抓取路径的提取器 fallback 与可诊断失败语义 MUST 遵循 web-extractor-plugins r332/r335（canonical）；出站 HTTP 代理合约见 architecture-core r_outbound_http。
  @req:r295
  规则: Unsupported formats are rejected with actionable diagnostics
    当上传/URL 抓取的内容无匹配 parser（例如缺失对应插件）时，系统 MUST 返回 415 且 MUST 提供可机器读取的诊断信息（errorCode/message/details），其中 details MUST 包含恢复提示（例如需要安装/启用的 `parser-*` 插件 id）。
  
    场景: unsupported-format-415-diagnostics
      假如 ingestion 集成环境就绪（tests/sources/parser-selection.test.ts）
      当 上传无匹配 parser 的文件（未知扩展名或未知显式 parserType）
      那么 415 信封 errorCode=UNSUPPORTED_MEDIA_TYPE 且 details 携带 mimeType/filename 与 parser-<ext> 形式的 pluginHint

@req:r296
  规则: Extractor selection errors are diagnosable
    fetch 模式显式指定 extractor 的尝试顺序与不可用时的 fallback/错误语义见 web-extractor-plugins r332/r335（canonical）；无论回退还是失败，系统 MUST 输出可诊断信息说明发生了什么与如何恢复。

    场景: extractor-errors-diagnosable
      假如 一个空白笔记本
      当 以 mode=fetch 且 extractor="not-a-real-extractor" 发送 from-url 请求（见 sources/ingest.test.ts 业务层拒绝用例）
      那么 请求被拒绝且返回可机器读取的诊断信息
      而且 诊断信息说明发生了什么与如何恢复
  @req:r297
  规则: Sources search MUST perform real web search
    POST /sources/search MUST 调用 web search 引擎（SearXNG）返回真实 web 结果，MUST NOT 返回 notebook 内向量匹配作为 placeholder；搜索引擎不可用或调用失败时 MUST 返回 status='service_error' 且 message MUST 为用户可读中文文案，MUST NOT 伪装为 'no_results' 或返回空成功响应；'no_results' MUST 仅表示引擎正常应答且零命中。前端 MUST 将 service_error 呈现为可与「无命中」区分的错误态（含重试入口或重试指引），MUST NOT 将其渲染为普通空结果提示。

    场景: sources-search-real-web-contract
      假如 web search 引擎不可用
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/sources/search"（见 sources-search.test.ts c65 用例）
      那么 响应 status 为 service_error 且 message 为用户可读中文文案
      而且 仅当引擎正常应答且零命中时才返回 no_results
  @req:r298
  规则: Dedup MUST be gated by config
    sources 去重 MUST 受 config source_ingestion.dedup.enabled 门控，为 false 时 MUST 跳过 dedup 直接创建新 source

    场景: dedup-gated-by-config
      假如 config 将 source_ingestion.dedup.enabled 设为 false
      当 重复上传同一内容且不带 create_new（见 sources/c117-upload-contract.test.ts）
      那么 跳过去重直接创建新来源且不返回 409
      而且 默认门控开启时重复上传仍返回 409 CONFLICT
