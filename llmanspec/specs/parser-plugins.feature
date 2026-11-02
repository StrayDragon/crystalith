# language: zh-CN
# capability: parser-plugins
# purpose: 定义 parser 插件的宿主契约：实现由插件提供、装载与清单、选择与 415 诊断、以及官方 docx 参考插件。使上传摄取在 core-only 与官方插件套件下可预测、可诊断。
# scope: apps/server/src/plugins

功能: parser-plugins

  @req:r496
  规则: File parsers are provided by plugins
    文件解析实现 MUST 由 kind 为 parser 的插件提供；core MUST 仅保留选择、415 诊断、分块与嵌入编排，以及稳定的解析结果模型。未安装或被禁用的 parser 插件，core MUST NOT 视为可用。core-only 底线格式（txt/md/csv，见 source-ingestion-core r258）MUST 由内建 parser 插件提供，MUST NOT 再维持绕过插件注册表的平行内建注册形状。

    场景: parsers-come-from-plugin-registry
      假如 内建 parser 插件与可选外部 parser 插件经同一注册表装载
      当 查询当前已装载的解析器集合
      那么 解析器实现由插件按装载顺序提供且被 denylist 命中的插件不可用
      而且 未安装或被禁用的 parser 插件不会被当作可用解析器

  @req:r497
  规则: Parser plugin exposes a stable parse contract
    parser 插件的 factory MUST 提供：稳定短标识、显示名、可处理的 MIME 与扩展名、以及把文件字节解析为可检索正文（可选分页）的能力。来源行的 parserType MUST 为该短标识（由插件 id 去掉 parser- 前缀派生）；插件 id MUST 写入来源元数据以便诊断。选择与 tie-break 见 source-ingestion-core r257（canonical）。

    场景: parser-wire-id-and-plugin-id-are-recorded
      假如 已装载短标识为 text 的内建 parser 插件
      当 上传一个 .txt 文件并读取来源行
      那么 来源 parserType 为 text
      而且 来源元数据记录对应的 parser 插件 id

  @req:r498
  规则: Parser list reflects loaded plugins only
    GET /v2/sources/parsers MUST 只列出当前已装载的 parser 插件，每项至少含短标识、显示名、MIME、扩展名，并 MAY 含插件 id。被策略跳过或 factory 失败的插件 MUST NOT 出现在该清单中，MUST 记入工作区工具诊断的 plugins.skipped（见 architecture-plugin-and-agent r17）。

    场景: parsers-list-matches-loaded-plugins
      假如 内建 parser 插件已装载且某一外部 parser 被 denylist 跳过
      当 请求 GET /v2/sources/parsers
      那么 响应仅含已装载解析器且每项含短标识、显示名、MIME 与扩展名
      而且 被跳过的插件不在清单中并出现在诊断 skipped

  @req:r499
  规则: Official parser-docx exemplar handles Word uploads
    仓库 MUST 提供官方参考插件 parser-docx，在安装并启用后能解析 .docx（及对应 Word MIME）为可检索 markdown 正文。该插件未安装或被禁用时，对上述输入的上传 MUST 保持 415，且诊断 details MUST 携带 pluginHint=parser-docx（见 source-ingestion-upload-and-url r295）。

    场景: parser-docx-ingests-word-or-stable-415
      假如 官方 parser-docx 插件可被发现
      当 分别在其已装载与被禁用两种状态下上传 .docx
      那么 已装载时来源 ready 且 parserType 为 docx
      而且 禁用时 415 且 details.pluginHint 为 parser-docx
