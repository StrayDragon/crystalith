# Design — c131 Adopt EmbeddingGemma 2

> 决策来源：proposal 深挖决策记录 1–5 + 2026-10-13 真机事实（tufa:50233）。c130（已归档）提供能力声明/Engine/元数据/维度感知地基。

## D1 目录条目与配置

- 新 anchor `eg2_gateway`（独立于 `embed_gateway`，bge-m3 回退路径不动）：
  - `CL_EMBEDDING2_API_BASE`，缺省 `http://tufa:50233/v1`；`CL_EMBEDDING2_API_KEY` 缺省 `local`。
- 条目 `embeddinggemma2-gateway`：provider `openai-compatible`、model `embeddinggemma-2`、roles `[embed]`、能力块 `{ dims: 768, mrlDims: [768, 512, 256, 128], modalities: [text], prefixPreset: embeddinggemma2 }`（MRL 仅声明，c133）。
- 默认翻转（T8，质量脚本通过后）：`models.defaults.embedding` → `embeddinggemma2-gateway`；env `CL_DEFAULT_EMBEDDING_MODEL` 仍可覆盖。既有 1024 维库 boot 即告警（c130 r478），指引指向重建按钮。

## D2 重建任务：两模式 + 异步生命周期

**两模式（由维度状态决定，确认弹窗文案区分）**：

- **维度一致 → 笔记本级重建**：对每个 ready source 执行 `deleteSourceVectors(sourceId)` + `indexSource(sourceId, notebookId)`；其他笔记本向量不受影响。
- **维度不一致 → 全局重建**：`vec_chunks` 是全局单表（vec0 按笔记本分区），维度变更必须 `DROP` + 按声明维度重建表，并重嵌**全部**笔记本的 ready sources（无迁移政策下的既定语义）。弹窗明示"会影响所有笔记本"。

**生命周期**：

- `POST /v2/notebooks/:nid/search-index/rebuild` → `202 { jobId }`；已有 running 任务 → `409`（防重入）。
- 后台逐 source 执行（顺序，尊重 `concurrency.embedding` 的既有排队语义）；逐条诊断（成功/失败 + 错误码）累计进任务记录。
- 完成：`bumpVectorEpoch(notebookId)`（全局模式逐笔记本 bump），缓存失效走 r227。
- **持久化与重启恢复**：新表 `index_jobs`（id、notebook_id、mode、state `running|succeeded|failed|interrupted`、total/done/failed 计数、started_at/finished_at、error）。进程内 Map 管活动任务；boot 扫描 `running` → 置 `interrupted`（不自动续跑，自托管语义下用户重点一次即可）。
- 迁移 `0009_index_jobs.sql`（手写，沿用 0008 模式）。

## D3 索引状态面（合并 W1）

- `GET /v2/notebooks/:nid/search-index`：
  `{ state: 'ready' | 'rebuilding' | 'dim_mismatch' | 'interrupted', declaredDims?, tableDims?, progress?: { total, done, failed }, lastJob?: { id, finishedAt, mode, counts } }`
- state 计算：活动任务 → `rebuilding`；否则 `parseVecDim(现表)` vs 声明 dims 不一致 → `dim_mismatch`（带两值）；最近任务 `interrupted` → `interrupted`；否则 `ready`。
- c130 的 boot 警告文案与 409 错误指引更新为指向该端点/按钮。

## D4 调用方降级（用户 2026-10-13 分类）

| 调用方                                     | 类别        | 行为                                                                                                                                 |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| QA 对话（qa/retrieve-and-judge → handler） | 忽略 + 提示 | 走既有 no-evidence 机制：新增 reason 值 `index_rebuilding`（`noEvidenceAnswerForReason` 返回提示文案，wire `noEvidenceReason` 透出） |
| 单源问答（source-extras QA）               | 忽略 + 提示 | 同上                                                                                                                                 |
| outputs 生成（pipeline 检索）              | 硬前置报错  | `409 INDEX_REBUILDING`（复用 EMBEDDING_DIM_MISMATCH 同款"状态冲突"先例）                                                             |
| studio slides getContext                   | 硬前置报错  | 同上                                                                                                                                 |
| research retrieveSourcesTool               | 自然降级    | 工具返回空数组（agent 侧既有语义，不改）                                                                                             |

判定时机：检索入口读 D3 state（`rebuilding` / `dim_mismatch` / `interrupted` 均视为不可用）。

## D5 W2：直写向量路径补元数据

抽 helper `markChunksEmbedded(sourceId, model, dims)`（rag 层，`UPDATE chunks SET embedding_model=…, embedding_dims=…`），indexSource / sessions convert / source-extras QA-to-source 三处调用；重嵌天然覆盖。

## D6 边界与前瞻：多模态 port（不实现）

方向已定（决策记录 5）：embedding 层定义多模态 port，入参 typed content parts：

```ts
interface MultimodalEmbedPort {
  embedContents(
    parts: ContentPart[],
    opts?: { task?: 'query' | 'document' },
  ): Promise<Float32Array[]>;
  // ContentPart = { type: 'text'; text } | { type: 'image'; ref } | { type: 'audio' | 'video'; ref }
}
```

第一个适配器对接 DashScope 兼容形状（contents 映射，图文；tufa 1:1 实现，公共云标准）；音频/视频/交错需要时加 `/embed/st` 适配器。c130 的 `chunks.modality` 是落库面。本 change 仅记录方向，不写代码。

## D7 质量脚本与翻转顺序

- `scripts/embedding-quality.ts`（bun，手动跑，不进 CI）：
  1. 前缀交叉验证：客户端 query/document 前缀 vs 服务端 `:SearchQuery`/`:Document` 后缀，cos ≥ 0.999999（2026-10-13 已手工验证通过，脚本固化方法）。
  2. 中文/中英混合/代码小样本 self-retrieval：各 ≥ 5 条语料，top-1 命中率报告。
  3. 基线数字（延迟/吞吐）记入 docs/embedding.md。
- T8 默认翻转在脚本产出合格后执行；脚本结果与翻转同一 PR 内留档。

## D8 文档

- docs/embedding.md：网关矩阵补 tufa 实测行（ai@7.0.138 零适配、恒归一、APICallError 详情在 responseBody、单飞锁）；重建指引从"手动 DROP"改为"按钮/端点优先，DROP 为兜底"；精度警告保留。
