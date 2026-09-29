# language: zh-CN
# capability: source-ingestion-core
# purpose: 定义 Source 摄取生命周期不变量：状态机、ready 语义、删除语义与 epoch 失效规则。该规范用于保证摄取与检索之间的因果一致性，避免出现"状态 ready 但不可检索"的漂移。
# scope: apps/server/src/features/sources/, apps/server/src/shared/extraction/

功能: source-ingestion-core

  @req:r253
  规则: Source status machine is fixed
    Source 状态 MUST 仅使用 `processing|ready|failed`，并保持对外稳定。

    场景: status-machine-fixed-vocabulary
      假如 一个空白笔记本
      当 上传一个文本文件并轮询 GET "/v2/notebooks/{当前笔记本[id]}/sources/{当前来源[id]}"
      那么 来源 status 仅在 processing、ready、failed 三者中取值
      而且 摄取成功后的终态为 ready
  @req:r254
  规则: Ready source guarantees retrievability
    `ready` 来源 MUST 已持久化 chunks 且对应向量可被检索命中（本条约束 ready⇒可检索的结果语义；ready 之前的同步完成时序由 r2_sync 单独约束）。
  @req:r255
  规则: Source and vector mutations bump epochs
    影响来源集合或向量集合的操作 MUST bump `sources_epoch` 与/或 `vector_epoch` 以触发缓存失效（失效模型见 retrieval-and-cache r227）。

    场景: mutations-bump-epochs
      假如 同一 notebook 内已有按 sources_epoch 与 vector_epoch 缓存的查询结果
      当 执行影响来源集合或向量集合的变更并 bump 相应 epoch（见 rag/cache.test.ts bump 失效用例）
      那么 同 epoch 写入的缓存不再命中
      而且 其他 notebook 的 epoch 不受影响
  @req:r256
  规则: Source deletion removes vector entries
    删除来源后 MUST 同步移除其 DB 记录与向量存储对应记录，防止幽灵检索结果。本条为来源删除清理语义的 canonical 约束。

    场景: source-delete-removes-vectors
      假如 笔记本内已有完成向量化的来源
      当 删除该来源（见 integration/notebook-delete-cleans-vectors.test.ts）
      那么 sqlite-vec 中对应向量被清除
      而且 后续检索不再命中该来源分块
  @req:r257
  规则: Parser selection is deterministic and observable
    系统 MUST 以确定性规则选择用于解析来源内容的 parser（优先已启用插件，其次 core 最小解析器）。 当多个插件 parser 同时命中同一输入时，系统 MUST 使用确定性 tie-break： - 优先按 `plugins.load_order`（若配置）确定优先级 - 否则按 `plugin_id` 字典序确定优先级 系统 MUST 在来源元数据中记录所用 `parser_type`，并 SHOULD 记录 `parser_plugin_id`（若该 parser 来自插件）以便诊断与回归。
  
    场景: parser-selection-is-deterministic-and-recorded
      假如 core parser 注册序为 pdf→html→csv→text（tests/sources/parser-selection.test.ts）
      当 分别以 text/plain、text/markdown、text/html、text/csv 上传并读取来源行
      那么 parserType 逐 case 记录为 text/text/html/csv 且无前缀匹配误配（application/* 不再落入 pdf）
      而且 显式 parserType 覆盖按注册表 id 解析（如 parserType=html 生效）

@req:r258
  规则: Core-only ingestion profile is minimal and explicit
    在 core-only 安装形态下，系统 MUST 至少支持 txt/md/markdown/csv 的 ingestion；其他格式 MUST 被视为不可用增强能力并以稳定的「不支持」语义拒绝（需通过插件安装/启用提供）。
  
    场景: unsupported-format-rejected-stably
      假如 core-only 安装形态（tests/sources/parser-selection.test.ts）
      当 上传 txt/md/markdown/csv 及 text parser 声明的文本超集（json/xml）时正常 ingest
      而且 上传无匹配 parser 的格式（如 docx）时
      那么 请求被 415 稳定拒绝且不创建来源行

@req:r259
  规则: Ready MUST follow synchronous embedding
    系统 MUST 在标记来源 ready 之前同步完成向量写入，不得使用 fire-and-forget embedding（本条约束 ready 之前的同步时序语义）；embedding 失败时 MUST 将来源标记为 failed 而非 ready。

    场景: ready-follows-synchronous-embedding
      假如 一个空白笔记本
      当 上传一个文本文件并跟踪 indexSource 完成时序（见 sources/embed-timing.test.ts）
      那么 来源仅在向量写入完成后才标记为 ready
      而且 embedding 抛出异常时来源被标记为 failed 而非 ready
  @req:r260
  规则: CSV parser MUST produce markdown-table chunks with row metadata
    CSV 解析 MUST 使用专用 CSV 解析器产出 markdown-table 格式分块（每块行数与单元格截断上限由 config schema 给出），并在 chunk metadata 中记录 csv_row_start/csv_row_end，MUST NOT 把 CSV 当纯文本 pass-through；markdown-table 单元格中的 `|` 与换行 MUST 转义，截断 MUST 以 … 省略号表示。本条为 CSV 解析契约（含单元格转义）的 canonical 约束。

    场景: csv-chunks-as-markdown-table
      假如 一个含长文本与特殊字符单元格的 CSV 文件
      当 通过上传创建来源并查看其 chunks（见 sources/csv-parser.test.ts）
      那么 分块为 markdown-table 格式且携带 csv_row_start 与 csv_row_end 元数据
      而且 单元格内的"|"与换行被转义、超限截断以"…"结尾
  @req:r261
  规则: Web search mode is not Deep Research
    POST …/sources/search 的 mode 字段 MUST 仅表示网搜通道元数据（默认 Fast Research 或等价）；MUST NOT 用 mode=Deep Research（或同义）触发或冒充 ResearchRun 深研编排；本约束 MUST NOT 删除或削弱 /v2/notebooks/:nid/research* ResearchRun API。

    场景: search-mode-normalized-fast-research
      假如 mock 网搜引擎可用并向 POST …/sources/search 分别提交 mode=Deep Research、自定义通道与缺省（mode-normalization.test.ts）
      当 路由回显 search 响应的 mode 字段
      那么 Deep Research 被归一化为 Fast Research、其余 mode 按元数据 echo、缺省为 Fast Research
      而且 全程 ResearchRun 表零写入且 /v2/notebooks/:nid/research* 保持不受影响
