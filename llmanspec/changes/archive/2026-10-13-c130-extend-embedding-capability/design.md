# Design — c130 Embedding 能力层

> 决策来源：2026-10-13 深挖记录（proposal.md）+ issue #7。本文件把这些决策展开成实现方案。

## D1 Engine 落位与角色映射

- 新模块 `apps/server/src/rag/embedding-engine.ts`；`embedder.ts` 保留为 facade（`embedSingle` / `embedBatch` 签名不变，消费方零改动）。
- 角色映射（消费方逐一核实过）：
  - `embedSingle(text)` = **query role**（消费方：embed-strategy retrieve、research node-agent 工具注入）。
  - `embedBatch(texts, opts?)` = **document role**（消费方：indexSource、sessions convert、source re-embed）。`opts.titles?: string[]` 可选承载 Document 前缀的 title（来源文件名，缺省 `none`）。
- 引擎内部：`resolve engine = 模型声明(dim/preset) → 拼前缀 → 调 AI SDK embed/embedMany → 维度断言 → 返回 Float32Array[]`。
- 模型解析单例保留在 facade（`_embedModel` 缓存逻辑不动）。

## D2 任务前缀：内置预设集

- `embedding-engine.ts` 内置预设表（SSOT）：

```ts
const PREFIX_PRESETS = {
  embeddinggemma2: {
    query: (q) => `task: search result | query: ${q}`,
    document: (title, text) => `title: ${title ?? 'none'} | text: ${text}`,
  },
} as const;
```

- 模型条目声明 `embedding.prefixPreset: "embeddinggemma2"`；config 加载时校验预设名存在（未知预设 = 配置错误）。
- 未声明 `prefixPreset`（bge-m3 现状）→ 不加前缀，行为与现状逐位一致。
- 不开放自由模板串（深挖决策 3：写错格式会让检索质量静默下降）。

## D3 维度感知与不匹配行为（深挖决策 1）

- 声明维度来源：默认 embedding 模型的 `embedding.dims`（未声明时回退 `DEFAULT_EMBEDDING_DIM = 1024`，兼容存量配置）。
- 现表维度来源：解析 `sqlite_master` 里 `vec_chunks` 的 `embedding float[N]`（复用现有 cosine 检查同款解析）。
- 行为：
  - **boot**：`initVecChunks` 发现不一致 → `console.warn` 一条含两值与重建指引的信息；不阻断启动。
  - **检索/索引路径**：engine 维度断言失败（或 KNN 前置检查）→ 抛 `AppHttpError(EMBEDDING_DIM_MISMATCH, ...)`，文案指向 c131 的 notebook 重建入口（c130 阶段文案指向 `sources/batch/re-embed` 与文档说明）。
  - keyword/BM25 路径不碰向量，天然不受影响。
- engine 断言双保险：AI SDK 返回维度 ≠ 声明 `dims` → 报错（网关换模型没改配置时立即暴露）。

## D4 chunks 索引元数据迁移

- 加列（全部带默认值，存量行回填）：

| 列                | 类型    | 默认             | 说明                                                    |
| ----------------- | ------- | ---------------- | ------------------------------------------------------- |
| `modality`        | text    | `'text'`         | #7 要求；多模态摄取后续 connector 才会写非 text         |
| `embedding_model` | text    | null             | 写入点：indexSource 插向量时随 chunk 行落库；重嵌时更新 |
| `embedding_dims`  | integer | null             | 同上                                                    |
| `origin_type`     | text    | `'source'`       | c132 启用（origin 泛化预埋）                            |
| `origin_id`       | integer | `source_id` 回填 | c132 启用                                               |

- 迁移走 drizzle generate（存量 meta 有已知非 TTY 交互问题，见 docs/known-issues.md——必要时手写 migration 文件，DDL 极简）。
- FTS5 `chunks_fts` 是 `content='chunks'` 外部内容表 + 触发器按 rowid 同步，加列不影响。
- c130 阶段 `origin_type/origin_id` 纯落库，无任何读取方（QA citation 路径零变化）。

## D5 配置与门禁联动

- `ModelConfigSchema.embedding` 可选块：`dims`(int>0) / `mrlDims`(int[]，仅声明) / `modalities`(string[]，默认 `['text']`) / `textOnlyLoad`(bool) / `prefixPreset`(内置预设名)。
- `app.schema.gen.json` 重新生成（`just check-app-schema` 门禁）；新 `desc()` key 进 `check-i18n-keys`。
- `EmbeddingSettings`（chunk_size/batch_size）不动——无 MRL 开关（决策 2）。
- app.yaml 既有 embed 条目（bge-m3 / qwen3 / text-embedding-3-small / gateway-embedding）补 `embedding.dims` 声明；eg2 条目归 c131。

## D6 specs 划分

- 新 capability `embedding-runtime`，validScope：`apps/server/src/rag/`、`apps/server/src/db/`、`packages/shared/src/schemas/`。
- 规则（可执行场景挂既有 bun test seam，沿用 retrieval-and-cache 的"场景引用测试文件"样式）：
  - 声明 SSOT + /v2/models 透出（config schema 解析 + ModelInfo）
  - 前缀按预设应用于 query/document 两侧（单测假模型）
  - 无声明 = 无前缀（bge-m3 现状回归）
  - 维度断言与不匹配行为（boot 警告 + 检索报错 + BM25 不受影响）
  - chunks 元数据落库（迁移后列存在 + indexSource 写入）
- 不改 retrieval-and-cache / configuration-governance 既有规则。

## D7 明确不做（边界）

- MRL 截断与任何入口 → c133（先调研）。
- 重建索引 API/按钮、eg2 目录条目、默认翻转 → c131。
- origin 列的读取方（outputs 入索引、QA origin 过滤）→ c132。
- 多模态摄取（image/audio/video 来源）→ 后续 connector 期。
