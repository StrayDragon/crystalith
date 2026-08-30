# language: zh-CN
# capability: source-ingestion-core
# purpose: 定义 Source 摄取生命周期不变量：状态机、ready 语义、删除语义与 epoch 失效规则。该规范用于保证摄取与检索之间的因果一致性，避免出现"状态 ready 但不可检索"的漂移。
# scope: apps/server/src/features/sources/, apps/server/src/shared/extraction/

功能: source-ingestion-core

  @req:r47 @human
  场景: Source status machine is fixed
    - Source 状态 MUST 仅使用 `processing|ready|failed`，并保持对外稳定。

  @req:r105 @human
  场景: Ready source guarantees retrievability
    - `ready` 来源 MUST 已持久化 chunks 且对应向量可被检索命中（本条约束 ready⇒可检索的结果语义；ready 之前的同步完成时序由 r2_sync 单独约束）。

  @req:r142 @human
  场景: Source and vector mutations bump epochs
    - 影响来源集合或向量集合的操作 MUST bump `sources_epoch` 与/或 `vector_epoch` 以触发缓存失效（失效模型见 retrieval-and-cache r174）。

  @req:r209 @human
  场景: Source deletion removes vector entries
    - 删除来源后 MUST 同步移除其 DB 记录与向量存储对应记录，防止幽灵检索结果。本条为来源删除清理语义的 canonical 约束。

  @req:r237 @human
  场景: Parser selection is deterministic and observable
    - 系统 MUST 以确定性规则选择用于解析来源内容的 parser（优先已启用插件，其次 core 最小解析器）。 当多个插件 parser 同时命中同一输入时，系统 MUST 使用确定性 tie-break： - 优先按 `plugins.load_order`（若配置）确定优先级 - 否则按 `plugin_id` 字典序确定优先级 系统 MUST 在来源元数据中记录所用 `parser_type`，并 SHOULD 记录 `parser_plugin_id`（若该 parser 来自插件）以便诊断与回归。

  @req:r255 @human
  场景: Core-only ingestion profile is minimal and explicit
    - 在 core-only 安装形态下，系统 MUST 至少支持 txt/md/markdown/csv 的 ingestion；其他格式 MUST 被视为不可用增强能力并以稳定的「不支持」语义拒绝（需通过插件安装/启用提供）。

  @req:r2_sync @human
  场景: Ready MUST follow synchronous embedding
    - 系统 MUST 在标记来源 ready 之前同步完成向量写入，不得使用 fire-and-forget embedding（本条约束 ready 之前的同步时序语义）；embedding 失败时 MUST 将来源标记为 failed 而非 ready。

  @req:csv-parser-markdown-table @human
  场景: CSV parser MUST produce markdown-table chunks with row metadata
    - CSV 解析 MUST 使用专用 CSV 解析器产出 markdown-table 格式分块（每块行数与单元格截断上限由 config schema 给出），并在 chunk metadata 中记录 csv_row_start/csv_row_end，MUST NOT 把 CSV 当纯文本 pass-through；markdown-table 单元格中的 `|` 与换行 MUST 转义，截断 MUST 以 … 省略号表示。本条为 CSV 解析契约（含单元格转义）的 canonical 约束。

  @req:r260 @human
  场景: Web search mode is not Deep Research
    - POST …/sources/search 的 mode 字段 MUST 仅表示网搜通道元数据（默认 Fast Research 或等价）；MUST NOT 用 mode=Deep Research（或同义）触发或冒充 ResearchRun 深研编排；本约束 MUST NOT 删除或削弱 /v2/notebooks/:nid/research* ResearchRun API。
