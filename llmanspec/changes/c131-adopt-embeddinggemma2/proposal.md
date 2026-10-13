---
depends_on: [c130-extend-embedding-capability]
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
3. **索引重建路径**（替代迁移）：notebook 级一键重建 API（清该笔记本 vec 行 + 对 ready sources 重跑 indexSource，完成 bump vector_epoch）+ **来源面板工具栏按钮**（确认弹窗说明会清空并重嵌该笔记本全部向量）。维度不匹配时 c130 的 409 报错指向此入口。
4. **默认翻转**：质量清单通过后 `defaults.embedding` → `embeddinggemma2-gateway`（env `CL_DEFAULT_EMBEDDING_MODEL` 可覆盖）；docs/embedding.md 的重建指引从"手动 DROP 表"升级为指向一键重建。
5. **c130 verify 转记（W1/W2）**：W1——重建入口落地时顺带在诊断面暴露维度状态（现表维度 vs 声明维度）；W2——`sessions/convert.ts` 与 `source-extras.router.ts` 两条直写向量路径补 chunk 元数据落库（或明确记录为边界）。

## Design 输入清单（正式 propose 时展开）

1. eg2 网关条目的 providerConfig 形态（沿用 `embed_gateway` anchor vs 独立 anchor；baseUrl 指向 tufa:50233 的 env 缺省值取舍）。
2. 重建 API 的 wire 形态与进度反馈（同步等待 vs 任务态轮询；重建期间该笔记本检索请求的降级行为）。
3. W2 的处理定案：convert/source-extras 直写路径补元数据（复用 indexSource 的 update 语句抽 helper）vs 记录边界不补。
4. 8K 共享上下文预算（eg2 模型卡）与现有 `chunk_size: 512` 的兼容性确认（512 token 窗口远小于 8K，无需调整；仅文档说明）。
5. 多模态输入在 OpenAI-compatible 字符串 API 下不可表达——本 change 仅文本侧；多模态摄取归后续 connector（c130 已留 modality 元数据；maas 项目 `assets/` 有真实音视图文样例与 `/embed/st` 入口可复用）。

## 深挖决策记录（2026-10-13，逐问确认）

1. **重建入口形态**：API 端点 + **来源面板工具栏按钮**（重建按笔记本作用，与上传/批量操作同区）。点击后确认弹窗说明会清空并重嵌该笔记本全部向量；完成 bump vector_epoch（缓存失效走既有 r227 语义）。（用户选定"按钮或方式"，位置经确认。）
2. **质量清单落点**：`scripts/` 手动脚本 + 文档记录基线数字。需要真实模型，不进 CI；确定性单测只覆盖引擎逻辑（前缀拼接、维度断言），不覆盖质量。
3. **MRL 不在主线**：c131 只接原生 768 维；截断评估归 c133（见 c130 决策记录 2）。

## 关联

- issue #5；依赖 c130-extend-embedding-capability；排序 c130 → **c131** →（c129、c132）
- **archive 约定（2026-10-13 用户指令）**：收口 commit 正文追加 `fixes #5`（GitHub 自动关闭 issue）。默认翻转若晚于本 change 收口，翻转提交正文同样带 `fixes #5` 兜底。
