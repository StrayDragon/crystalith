# language: zh-CN
# capability: embedding-runtime
# purpose: 定义 embedding 运行时能力面：模型目录的能力声明 SSOT、任务前缀预设、维度一致性、vec 表维度不匹配行为与 chunks 索引元数据。MRL 截断实现（c133）与重建入口（c131）不在本能力内。
# scope: apps/server/src/rag/, apps/server/src/db/, packages/shared/src/schemas/

功能: embedding-runtime

  @req:r474
  规则: Embedding capability declaration is the catalog SSOT
    模型目录的 embedding 能力声明 MUST 以 `ModelConfigSchema` 可选 `embedding` 块为 SSOT（dims、mrlDims、modalities、textOnlyLoad、prefixPreset）。dims MUST 为正整数；prefixPreset MUST 属内置预设名，未知值 MUST 拒绝加载。`GET /v2/models` 的 ModelInfo MUST 透出该声明块（可选、additive）。mrlDims 在本能力内仅为声明与透出，MUST NOT 产生任何截断行为。

    场景: config-rejects-invalid-embedding-block
      假如 app.yaml 的某个 embed 模型条目携带 embedding 块
      当 运行 apps/server/tests/config.test.ts 的 embedding 声明解析用例（dims 非正整数 / prefixPreset 未知名 / 合法块）
      那么 非法块被拒绝并给出可读错误
      而且 合法块解析出的字段与声明一致并在 ModelInfo 中原样透出

  @req:r475
  规则: Task prefixes come from built-in presets
    任务前缀 MUST 来自内置预设集（engine 内 SSOT），按角色应用：query role 用查询模板，document role 用文档模板（title 缺省 `none`）。模型目录 MUST NOT 携带自由模板串。声明了 prefixPreset 的模型，其嵌入输入 MUST 先拼前缀再送 provider。

    场景: preset-applies-both-roles
      假如 注入假 embed 模型并选择 embeddinggemma2 预设
      当 运行 apps/server/tests/rag/embedding-engine.test.ts 的前缀用例
      那么 query 侧输入为 "task: search result | query: {原文}"
      而且 document 侧输入为 "title: {title 或 none} | text: {原文}"

  @req:r476
  规则: Models without declaration behave exactly as before
    未声明 embedding 块（或未声明 prefixPreset）的模型，嵌入输入 MUST NOT 添加任何前缀，行为与既有检索链路逐位一致。

    场景: undeclared-model-zero-prefix-regression
      假如 默认 embedding 模型未携带任何 embedding 声明
      当 运行 apps/server/tests/rag/embedding-engine.test.ts 的零前缀用例，并回归 rag/embed-similarity.test.ts 与 rag/unified-retrieval.test.ts 全量用例
      那么 输入文本原样送达 provider（零前缀）
      而且 既有检索断言全部通过

  @req:r477
  规则: Engine asserts dimension consistency
    EmbeddingEngine MUST 断言 provider 返回向量维度与模型声明 dims 一致；不一致时 MUST 抛出携带两值的明确错误，MUST NOT 把维度异常的向量写入 vec 表。

    场景: provider-dim-mismatch-errors
      假如 假 embed 模型返回的向量长度与声明 dims 不符
      当 运行 apps/server/tests/rag/embedding-engine.test.ts 的维度断言用例
      那么 抛出的错误包含声明维度与实际维度
      而且 没有任何向量写入发生

  @req:r478
  规则: Vec table dim mismatch warns at boot and errors on retrieval
    vec_chunks 现表维度与默认模型声明维度不一致时：boot MUST 输出警告（含两值与重建指引）且 MUST NOT 阻断启动；语义检索与向量写入路径 MUST 抛明确错误指向重建入口；keyword/BM25 路径 MUST NOT 受影响。

    场景: dim-mismatch-warn-but-bm25-alive
      假如 vec_chunks 建表为 1024 维而默认模型声明 768 维
      当 运行维度不匹配用例（boot init 与 searchVectors 调用）
      那么 boot 输出包含 1024 与 768 的警告且启动完成
      而且 searchVectors 抛出指向重建入口的明确错误
      而且 keyword 策略检索正常返回

  @req:r479
  规则: Chunks carry embedding index metadata
    chunks 表 MUST 携带索引元数据列：modality（默认 text）、embedding_model、embedding_dims，以及 origin 预埋列 origin_type（默认 source）与 origin_id（存量行回填 source_id）。indexSource 写入向量时 MUST 同步落库 embedding_model 与 embedding_dims；重嵌 MUST 更新而非残留旧值。本能力内 origin 列 MUST NOT 有任何读取方。

    场景: migration-adds-metadata-with-defaults
      假如 存量库已包含 chunks 行
      当 执行迁移后运行 apps/server/tests/db.test.ts 的元数据列用例
      那么 新列存在且 modality 全为 text、origin_type 全为 source、origin_id 等于 source_id
      而且 FTS5 同步触发器行为不变（keyword 策略回归通过）

    场景: indexsource-writes-model-and-dims
      假如 默认 embedding 模型携带声明（含 dims）
      当 运行 indexSource 后检查 chunk 行
      那么 embedding_model 为模型条目 id 且 embedding_dims 等于实际向量长度
      而且 重嵌后两列反映最新一次嵌入
