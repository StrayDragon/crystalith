---
depends_on: [c130-extend-embedding-capability]
branch: sdd/c131-adopt-embeddinggemma2
base_branch: main
base_sha: de88025ba5648e68b5119e8a771a090541d9b29b
---

# Adopt EmbeddingGemma 2：目录接入 + 索引重建路径 + 质量清单 + 默认切换

> **草案**（2026-10-13，对应 issue #5）。待正式 `/llman-sdd-apply` 前跑 `/llman-sdd-propose` 充实 design/tasks。
> 已锁定决策（2026-10-13）：**不做 re-embed 迁移机械**（项目无用户未推广，切模型 = 重建索引，greenfield 可接受）。
> **前提更新（2026-10-13 晚）**：用户已部署 EG2 服务（`tufa:50233`，项目 `~/Projects/__straydragon__/maas-embeddinggemma2`，模型名 `embeddinggemma-2`）——"默认切换等网关就绪"条件已满足，**默认翻转并入本 change 范围**（质量清单通过后执行）。

## Why

- issue #5：集成 EmbeddingGemma 2（Google，Apache 2.0，740M 多模态：text/image/video/audio → 统一 768d 空间）作为默认 embedding 模型。
- 外部事实（2026-10-13 核实）：eg2 发布仅数天，**Ollama / llama.cpp GGUF / MLX 网关支持尚未确认落地**（一代 embeddinggemma 300M 文本版有；二代多模态版社区跟进中）——这是默认切换的硬前置。
- 依赖 c130：eg2 的任务前缀（SearchQuery/Document 模板）与 MRL（768/512/256/128 + 强制 renormalize）必须走能力声明层，不能特判。

## 真机事实（2026-10-13 实测 tufa:50233，依据 sdk-test/INTEGRATION.md）

- OpenAI 兼容 `POST /v1/embeddings` 与本仓 `ai@7.0.138` 实测零适配；768 维、恒归一（点积即余弦）、usage 为真实 tokenizer 计数。
- **c130 前缀模板真机交叉验证通过**：客户端 query 前缀 vs 服务端 `:SearchQuery` 后缀 cos=1.00000006；document `title: none` 形态 cos=0.99999994。模板逐位正确，继续走客户端前缀（不依赖服务端后缀约定）。
- 排错注意：AI SDK `APICallError.message` 只有 "Bad Request"，详情在 `error.responseBody`；服务端单飞锁串行处理批量，客户端并发只会在服务端排队（`concurrency.embedding=8` 不用改）。
- 性能基线（BENCHMARK.md，ROCm fp32）：文本单条 p50 24ms、batch×32 约 500/s、batch×64 约 530/s；Document 前缀 +25% 时延。
- 服务端另有 `dimensions` 参数（MRL 截断）与多模态 `/embed/st` 入口——前者记入 c133，后者归后续多模态 connector（`assets/` 有音视图文真实样例可复用）。

## What Changes（预研骨架）

1. **目录条目**：app.yaml 增 `embeddinggemma2-gateway`（provider openai-compatible，model `embeddinggemma-2`，baseUrl 走 `CL_EMBEDDING_API_BASE` env），携带 c130 能力块：`dims: 768`、`mrlDims: [768,512,256,128]`、`prefixPreset: embeddinggemma2`；精度要求（bf16/fp32，禁 fp16）写入 docs/embedding.md 网关矩阵行更新。
2. **质量清单（默认翻转的前置门）**：`scripts/` 真机脚本——① 前缀交叉验证（客户端 vs 服务端后缀，cos≥0.999999，复用 2026-10-13 方法）；② 中文/中英混合/代码小样本检索 sanity（self-retrieval top-1 命中）；③ 基线数字记录进文档。不进 CI（需真实网关，env gate 可选）。
3. **索引重建路径**（替代迁移）：notebook 级**异步**重建——启动端点立即返回任务句柄，后台清该笔记本 vec 行 + 逐 ready source 重跑 indexSource，进度可查询；完成后 bump vector_epoch（缓存失效走既有 r227 语义）。入口：**来源面板工具栏按钮**（确认弹窗说明会清空并重嵌该笔记本全部向量；启动后按钮转进度态）。维度不匹配时 c130 的 409 报错指向此入口。
   - **调用方降级策略（用户 2026-10-13 定）**：重建期间依赖 embed 结果的功能——对话/QA 类**忽略检索并提示**（"索引重建中，本轮回答未引用来源"）；embed 为硬前置的功能**明确报错**。各调用方归属（qa / outputs / studio / research 工具 / 单源问答）在 design 期逐个分类。
4. **默认翻转**：质量清单通过后 `defaults.embedding` → `embeddinggemma2-gateway`（env `CL_DEFAULT_EMBEDDING_MODEL` 可覆盖）；docs/embedding.md 的重建指引从"手动 DROP 表"升级为指向一键重建。
5. **c130 verify 转记（W1/W2）**：W1——重建入口落地时顺带在诊断面暴露维度状态（现表维度 vs 声明维度）；W2——`sessions/convert.ts` 与 `source-extras.router.ts` 两条直写向量路径补 chunk 元数据落库（或明确记录为边界）。

## Design 输入清单（正式 propose 时展开）

1. eg2 网关条目的 providerConfig 形态（沿用 `embed_gateway` anchor vs 独立 anchor——独立 anchor 时 baseUrl 的 env 名与缺省值 `tufa:50233`；既有 `embed_gateway` 不动，bge-m3 条目继续可用作回退）。
2. 重建任务态设计：任务句柄与进度查询的 wire；**重启恢复**（进程内态 + DB 标记的取舍，重启后能识别"未完成重建"并续跑或标记失败）；重建中的并发请求防重入；与 `sources_epoch/vector_epoch` 的 bump 时机。
3. **索引状态面（合并 W1）**：`rebuilding | ready | dim-mismatch`（含现表/声明两维度值）统一暴露——诊断端点或 /v2/models 附带；QA/前端据此刻画降级提示。降级分类审计：qa 对话（忽略+提示）、单源问答、outputs 生成、studio slides、research retrieveSourcesTool 各归"忽略+提示"还是"硬前置报错"。
4. W2 的处理定案：convert/source-extras 直写路径补元数据（复用 indexSource 的 update 语句抽 helper）vs 记录边界不补（倾向补——三处调用点，改动小）。
5. 8K 共享上下文预算（eg2 模型卡）与现有 `chunk_size: 512` 的兼容性确认（512 token 窗口远小于 8K，无需调整；仅文档说明）。
6. 多模态 port 方向注记（决策记录 5）落进 design 的"边界与前瞻"节：port 签名草案（content parts）、DashScope 适配器要点，明确不实现。

## 深挖决策记录（2026-10-13，逐问确认）

1. **重建入口形态**：API 端点 + **来源面板工具栏按钮**（重建按笔记本作用，与上传/批量操作同区）。点击后确认弹窗说明会清空并重嵌该笔记本全部向量；完成 bump vector_epoch（缓存失效走既有 r227 语义）。（用户选定"按钮或方式"，位置经确认。）
2. **质量清单落点**：`scripts/` 手动脚本 + 文档记录基线数字。需要真实模型，不进 CI；确定性单测只覆盖引擎逻辑（前缀拼接、维度断言），不覆盖质量。
3. **MRL 不在主线**：c131 只接原生 768 维；截断评估归 c133（见 c130 决策记录 2）。
4. **重建任务异步化**（用户 2026-10-13 晚定，推翻早先同步方案）：同步等待容易卡用户操作；启动即返回 + 后台执行 + 进度查询。配套降级语义见 What Changes 3。
5. **非文本 embed 的 API 风格**（用户 2026-10-13 晚定）：**port + DashScope 兼容适配器**。定义多模态 embed port（typed content parts 入参，落在 embedding 层），第一个适配器对接 DashScope 兼容形状（图文，公共云标准、tufa 服务 1:1 实现）；音频/视频/交错输入需要时再加 `/embed/st` 适配器。port 隔离保证选择可逆、不锁私有形状。实现留在后续多模态 connector 期，c131 仅记录方向。

## Capabilities

- **新增 `embedding-index-ops`**：重建任务生命周期（两模式 + 防重入 + 重启恢复）、索引状态面（ready/rebuilding/dim_mismatch/interrupted）、调用方降级分类（忽略+提示 vs 硬前置报错）、全向量写路径元数据（W2 收口）。
- 不改 `embedding-runtime`（已归档 r474–r479）：W2 以新规则落 index-ops，避免编辑已锁定条款；默认翻转与目录条目为配置数据，由 config test 守护。

## Impact

- `config/app.yaml`（eg2 anchor + 条目 + 默认翻转）、`packages/shared`（重建/状态 Zod schema、qa no-evidence reason 增值——additive）。
- `apps/server`：features/sources（search-index router）、rag（重建引擎 + 元数据 helper）、db（`index_jobs` 表 + 迁移 0009）、shared/errors（`INDEX_REBUILDING`）。
- `apps/web`：sources 面板工具栏按钮 + 确认弹窗 + 进度轮询 + QA 降级提示。
- `docs/embedding.md`（tufa 实测行、重建指引、质量基线）、`scripts/embedding-quality.ts`（新）。

## 范围备注（verify W2 记录——门禁驱动的测试/配置基建改动）

以下改动超出 tasks 字面范围，均为通过 `just qa` 门禁所必需，且不改变任何运行时生产行为：

1. `.fallowrc.json` entry 登记 `apps/web/src/**/*.test.{ts,tsx}`：fallow 未自动识别 rstest 测试入口，109 个既有 web 测试文件此前被计入 dead-file 基线；新测试文件会被误判 introduced。登记后测试文件正式成为入口（与既有 test-utils 条目同类别）。
2. `setupIntegrationEnv` 封闭化：`resetConfig` 增加 `configExplicitlySet` 标记，未显式 seed 的集成测试自动种 chat-only 配置（嵌入维度回退 1024）——否则从仓库根跑门禁时会继承真实 app.yaml 的维度（runner CWD 相关）；`db.test.ts` 直连 createDb，单独补 seed。
3. `resetEmbedderForTests()`（embedder facade 测试重置缝）：引擎单例缓存跨 resetConfig 失效，维度变更类测试需要"新进程"语义；生产路径不受影响（配置每进程只读一次）。

## verify 补充（2026-10-13）

- 修复：research retrieveSources 工具重建期间返回部分证据 → 空集守卫 + 测试（r482 补全）。
- 补测：studio slides 409 守卫直接测试（W1）。
- 修剪：`index_jobs` 每笔记本仅保留最新一条历史（启动时 + 完成后修剪，running 永不剪）——表规模收敛到约每笔记本一行（suggestion 兑现）。
- maas 网关 500 bug（W3）：根因为服务端长跑进程 ROCm fp32+sdpa 注意力 NaN（非 tokenizer）；服务端已修（`_encode_finite()` CPU 重算兜底 + 可读 500 + trace_id，附回归测试）。本仓六形态复测全 200、向量有限；`scripts/embedding-quality.ts` 恢复自然触发串措辞作为回归样例，docs 同步更新。

## 关联

- issue #5；依赖 c130-extend-embedding-capability；排序 c130 → **c131** →（c129、c132）
- **archive 约定（2026-10-13 用户指令）**：收口 commit 正文追加 `fixes #5`（GitHub 自动关闭 issue）。默认翻转若晚于本 change 收口，翻转提交正文同样带 `fixes #5` 兜底。
