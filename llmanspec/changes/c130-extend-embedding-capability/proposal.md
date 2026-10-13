---
depends_on: []
---

# Embedding 能力层：声明式 registry + Engine + chunks 索引元数据

> **草案**（2026-10-13，对应 issue #7）。待正式 `/llman-sdd-propose` 充实 design/tasks。
> 已锁定决策：**默认模型不变（bge-m3），本 change 非破坏**；chunk origin 泛化在本 change 预埋列、c132 启用（决策 A）；排序上先于 c129-pg-backend（chunks 元数据迁移按方言可移植设计，pgvector 列一次做对）。

## Why

- issue #7：模型能力面产品化——provider 声明 `modality/dims/MRL/任务前缀`，embedding 层按声明执行，避免每个新模型特判。
- 现状差距（2026-10-13 代码盘点）：
  - `rag/embedder.ts` 仅 64 行直通层：`embed/embedMany` 裸调默认模型，无 query/document 区分、无任务前缀、无 MRL、无维度校验。
  - `ModelConfigSchema`（packages/shared model.ts）的 `capabilities` 是 chat 语义枚举，无任何 embedding 能力字段。
  - `db/vectors.ts` 维度硬编码 `DEFAULT_EMBEDDING_DIM = 1024`；`chunks` 表无 modality / 模型 / 维度列——re-embed 校验无落点。
  - EmbeddingGemma 2（issue #5 目标模型）强依赖任务前缀与 MRL renormalize，没有本层则无法正确接入。

## What Changes（预研骨架）

1. **模型目录能力声明**：`ModelConfigSchema` 增可选 `embedding` 块——`dims` / `mrlDims` / `modalities` / `textOnlyLoad` / `taskPrefixes{query,document}`；`GET /v2/models`（ModelInfo）透出；app.yaml 既有条目不受影响（可选块）。
2. **EmbeddingEngine**（重写 `rag/embedder.ts` 内部，对外 facade `embedSingle/embedBatch` 签名不变，消费方零改动）：
   - 按模型声明应用任务前缀（query role vs document role）；
   - MRL 截断（`truncate_dim`）后**强制 L2 renormalize**；query/document 维度一致性断言；
   - 未声明能力的模型（bge-m3）行为与现状完全一致。
3. **chunks 索引元数据迁移**：加列 `modality`（默认 `text`）、`embedding_model`、`embedding_dims`；同时预埋 origin 泛化列（`origin_type` 默认 `'source'` + `origin_id`，决策 A，c132 启用，QA citation 路径零变化）。
4. **vec 表维度感知**：启动时校验「声明维度 vs 现表维度」，不匹配 → 明确报错并指向重建路径（政策：**切模型 = 重建索引**，不做迁移；见 c131）。
5. **specs**：新增 `embedding-runtime` capability（能力声明 SSOT、前缀应用、MRL renormalize、维度一致性 MUST 合约）。
6. **文档**：推理网关矩阵（OMLX / Ollama / llama.cpp / TEI）、精度警告（EmbeddingGemma 2 必须 bf16/fp32，禁 fp16）、Mac MLX 与 Vulkan/ROCm 推荐路径。

## Design 输入清单（正式 propose 时展开）

1. 前缀模板精确形态（EmbeddingGemma 2 模型卡）：query `task: search result | query: {q}`；document `title: {来源文件名} | text: {chunk}`（title 缺省 `none`）。document title 的取数链（source filename 经 strategy 传入 engine）。
2. query/document **非对称嵌入点**：`indexSource`（document role）与 `retrieve`/`retrieveSourcesTool`（query role）——embed-strategy 与 tools 两侧的 role 传递方式。
3. Engine 落位：embedder.ts 内部重构 vs 新模块 `rag/embedding-engine.ts`（倾向后者，embedder.ts 降级 facade）。
4. 维度不匹配的报错形态：boot fail-fast vs 运行时首查报错 + 诊断信息（倾向 boot 警告 + 检索路径明确报错，不静默）。
5. `embedding_model/dims` 写入点：indexSource 插入向量时随 chunk 行落库；重嵌时更新。
6. modality 列的消费边界：本 change 只落库与透出（source schema 已有 mimeType），多模态摄取是后续 connector 的事。
7. `app.schema.gen.json` 门禁与 `check-i18n-keys` 随 config schema 扩展联动。
8. specs `retrieval-and-cache` 的 r229（score = 1 - distance）在 MRL renormalize 后仍成立（归一化向量余弦语义不变）——验证场景补一条。

## 关联

- issue #7（本 change 主体）、#5（c131 消费本层）、#6（c132 消费 origin/modality 元数据）
- 排序：c130 → c131 →（c129-pg-backend、c132）
