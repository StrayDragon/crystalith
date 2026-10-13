---
depends_on: [c130-extend-embedding-capability]
---

# Adopt EmbeddingGemma 2：目录接入 + 索引重建路径 + 质量清单（默认切换待网关就绪）

> **草案**（2026-10-13，对应 issue #5）。待正式 `/llman-sdd-propose` 充实 design/tasks。
> 已锁定决策（2026-10-13）：**不做 re-embed 迁移机械**（项目无用户未推广，切模型 = 重建索引，greenfield 可接受）；**默认值切换等用户网关可 serve eg2 后再翻**——本 change 交付目录接入 + 重建路径 + 质量清单，issue 验收以「配置就绪 + 文档 + 指引」达成，最终 `defaults.embedding` 翻转作为网关验证后的收尾动作（可独立小提交）。

## Why

- issue #5：集成 EmbeddingGemma 2（Google，Apache 2.0，740M 多模态：text/image/video/audio → 统一 768d 空间）作为默认 embedding 模型。
- 外部事实（2026-10-13 核实）：eg2 发布仅数天，**Ollama / llama.cpp GGUF / MLX 网关支持尚未确认落地**（一代 embeddinggemma 300M 文本版有；二代多模态版社区跟进中）——这是默认切换的硬前置。
- 依赖 c130：eg2 的任务前缀（SearchQuery/Document 模板）与 MRL（768/512/256/128 + 强制 renormalize）必须走能力声明层，不能特判。

## What Changes（预研骨架）

1. **目录条目**：app.yaml 增 eg2 条目（`embeddinggemma2-gateway` 等，OpenAI-compatible 网关形态），携带 c130 能力块（`dims: 768`、`mrlDims`、`taskPrefixes`）；文档写清各运行时接入方式与精度要求（bf16/fp32，**禁 fp16**——NaN/静默劣化）。
2. **网关可用性验证矩阵**：Ollama / llama.cpp / TEI / OMLX / MLX 现状核实表（文档维护，标注「未落地」项）；OpenAI `/v1/embeddings` 只收字符串 → 前缀由 Crystalith 侧拼接后送网关（c130 Engine 职责），网关无需感知。
3. **索引重建路径**（替代迁移）：notebook 级一键重建（清 vec 行 + 对 ready sources 重跑 indexSource）；既有 `sources/batch/re-embed` 覆盖失败来源，补全量入口。维度不匹配时 c130 的报错指向此路径。
4. **质量回归清单**：中文 / 中英混合 / 代码小样本（#7 验收项）落测试或脚本；前缀 on/off 检索质量对比（防前缀误用拉低召回）；MRL 256d vs 768d 对比（默认 768 原生，`truncate_dim` 可选开）。
5. **默认翻转收尾**：网关就绪后 `CL_DEFAULT_EMBEDDING_MODEL` / `defaults.embedding` 指向 eg2 + 重建指引置顶（独立小提交，本 change 追踪）。

## Design 输入清单（正式 propose 时展开）

1. eg2 网关条目的 providerConfig 形态（沿用 `embed_gateway` anchor vs 独立 anchor）。
2. 重建入口形态：API（`POST /v2/notebooks/:nid/search-index/rebuild` 风格）vs CLI/脚本 vs 两者；与 `sources_epoch/vector_epoch` 联动（重建完成 bump，缓存失效走既有 r227 语义）。
3. 质量清单的落点：确定性测试（固定小语料 + 假 embed 不可行——需真实模型，倾向 `scripts/` 手动脚本 + 文档记录基线数字）vs 可选集成测试（env gate）。
4. 8K 共享上下文预算（eg2 模型卡）与现有 `chunk_size: 512` 的兼容性确认（512 token 窗口远小于 8K，无需调整；仅文档说明）。
5. 多模态输入（image/video/audio placeholder token）在 OpenAI-compatible 字符串 API 下不可表达——明确本 change 仅文本侧，多模态摄取归后续 connector（与 #7 的 modality 元数据预留衔接）。

## 关联

- issue #5；依赖 c130-extend-embedding-capability；排序 c130 → **c131** →（c129、c132）
- **archive 约定（2026-10-13 用户指令）**：收口 commit 正文追加 `fixes #5`（GitHub 自动关闭 issue）。默认翻转若晚于本 change 收口，翻转提交正文同样带 `fixes #5` 兜底。
