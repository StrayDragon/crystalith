---
depends_on: []
branch: sdd/c130-extend-embedding-capability
base_branch: main
base_sha: 1981c9e2a21293605a5a5bc6355c78c104508c1d
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

1. **模型目录能力声明**：`ModelConfigSchema` 增可选 `embedding` 块——`dims` / `mrlDims`（仅声明与透出，截断实现后置 c133）/ `modalities` / `textOnlyLoad` / `prefixPreset`（内置模板集名，如 `embeddinggemma2`；未声明 = 无前缀）；`GET /v2/models`（ModelInfo）透出；app.yaml 既有条目不受影响（可选块）。
2. **EmbeddingEngine**（重写 `rag/embedder.ts` 内部，对外 facade `embedSingle/embedBatch` 签名不变，消费方零改动）：
   - 按 `prefixPreset` 应用任务前缀（query role / document role）；
   - 引擎输出维度与 vec 表声明维度的一致性断言；
   - 未声明能力的模型（bge-m3）行为与现状完全一致；
   - **MRL 截断不在本 change**（后置 c133-enable-mrl-truncation，见决策记录）。
3. **chunks 索引元数据迁移**：加列 `modality`（默认 `text`）、`embedding_model`、`embedding_dims`；同时预埋 origin 泛化列（`origin_type` 默认 `'source'` + `origin_id`，决策 A，c132 启用，QA citation 路径零变化）。
4. **vec 表维度感知**：启动时校验「声明维度 vs 现表维度」，不匹配 → 明确报错并指向重建路径（政策：**切模型 = 重建索引**，不做迁移；见 c131）。
5. **specs**：新增 `embedding-runtime` capability（能力声明 SSOT、前缀应用、MRL renormalize、维度一致性 MUST 合约）。
6. **文档**：推理网关矩阵（OMLX / Ollama / llama.cpp / TEI）、精度警告（EmbeddingGemma 2 必须 bf16/fp32，禁 fp16）、Mac MLX 与 Vulkan/ROCm 推荐路径。

## 深挖决策记录（2026-10-13，逐问确认）

1. **维度不匹配的行为**：警告 + 检索路径报错。启动不阻断（日志与诊断端点写警告）；语义检索/索引第一次调用时明确报错并指向重建入口；keyword/BM25 不受影响，其余功能可用。（用户选定，并要求提供手动重建方式——入口落在 c131，来源面板工具栏。）
2. **MRL**：本 change 不写截断实现，仅声明 `mrlDims` 并透出。引擎截断 + 再归一化后置为 c133-enable-mrl-truncation（定位优化，先补调研；依据用户"配置面从薄、主线先不写"意见）。
3. **任务前缀形态**：内置预设集。模型条目只填预设名（如 `embeddinggemma2`），应用内置该家族的精确模板；不开放自由模板串（写错格式会让检索质量静默下降，难排查）；未声明预设 = 无前缀（bge-m3 现状不变）。
4. **角色映射（事实核清）**：`embedSingle` 消费方全部是查询侧（embed-strategy retrieve、research node-agent 工具注入），`embedBatch` 消费方全部是文档侧（indexSource、sessions convert、source re-embed）——facade 以"单条 = query、批量 = document"零改动承载角色；`embedBatch` 增可选 `titles` 参数承载 Document 前缀的 title（来源文件名；缺省 `none`）。
5. **前缀模板事实（模型卡）**：query `task: search result | query: {q}`；document `title: {t} | text: {content}`。

## Design 输入清单（正式 propose 时展开）

1. Engine 落位：新模块 `rag/embedding-engine.ts` vs embedder.ts 内部重构（倾向前者，embedder.ts 降级 facade）。
2. boot 警告与诊断端点的具体呈现（警告文案字段、`/v2/models` 或诊断端点暴露维度状态）。
3. `embedding_model/dims` 写入点：indexSource 插入向量时随 chunk 行落库；重嵌时更新。
4. `app.schema.gen.json` 门禁与 `check-i18n-keys` 随 config schema 扩展联动。
5. specs：新增 `embedding-runtime` capability（vs 扩展 retrieval-and-cache / configuration-governance 的 requirement 划分，倾向新 capability）。
6. 验证场景：前缀开启模型（假 embed）下 r229 score 语义与检索链路不回归。

## Capabilities

- **新增 `embedding-runtime`**：embedding 能力声明 SSOT、任务前缀应用、维度一致性、维度不匹配行为、chunks 索引元数据的 MUST 合约。
- 不动 `retrieval-and-cache`（r229 score 语义不变，前缀开启后仍成立——验证场景放新 capability）；不动 `configuration-governance`（模型目录 schema 扩展属既有"可选字段向后兼容"条款覆盖）。

## Impact

- `packages/shared/src/schemas/model.ts`：ModelConfigSchema 增可选 `embedding` 块；ModelInfo 增可选透出（additive，Eden 类型自动跟随）。
- `apps/server/src/rag/`：新 `embedding-engine.ts`；`embedder.ts` 降级 facade。
- `apps/server/src/db/`：chunks 表加列迁移（modality / embedding_model / embedding_dims / origin_type / origin_id）；`vectors.ts` 维度感知。
- `config/app.yaml`：既有 embed 条目补 `dims` 声明（无行为变化）。
- Web：无必改（ModelInfo additive）；文档更新（网关矩阵、精度警告）。

## 关联

- issue #7（本 change 主体）、#5（c131 消费本层）、#6（c132 消费 origin/modality 元数据）
- 排序：c130 → c131 →（c129-pg-backend、c132）
- **archive 约定（2026-10-13 用户指令）**：收口 commit 正文追加 `fixes #7`（GitHub 自动关闭 issue；finalize 走 `--no-commit` 后手工提交注入，或 amend）。
