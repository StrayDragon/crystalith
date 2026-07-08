---
depends_on: [c16-fix-v2-rag-foundations, c20-fix-v2-outputs-and-refine]
blocks: []
batch: all
---

# c27-add-v2-outputs-rag-retrieval — outputs 生成接入 RAG 检索

## Why

GAP-REPORT outputs 行（🟡）：v2 outputs 生成管线**无向量检索**——当前 `pipeline.ts:38-63` 把 notebook 的**全部 chunk** dump 进 prompt（或指定 chunk_ids），大 notebook 会爆上下文窗口，且无 citations、无偏好调优、无 schema 修复循环。

v1 `output_graph.py` 有完整 RAG：embed 检索 top-k + citations + 偏好（quality/speed）+ 修复循环。

本 change 让 outputs 生成接入已有 RAG registry（c16 已就位），复用 embed 策略。

## What Changes

- **MODIFIED** `features/outputs/pipeline.ts`: 用 `ragRegistry.retrieveWith('embed', notebookId, query, topK)` 替代 dump-all-chunks；query 由 output 类型 + 主题构造
- **MODIFIED** `features/outputs/generator.ts`: 把检索到的 chunk 作为 context + citations 附到输出
- **NEW** `GenerationPreference` (quality/speed) 参数：quality→topK=10, speed→topK=3
- **KEPT** 现有指定 chunk_ids 模式（显式选择时不走检索）
- 对照 v1 `shared/agents/output_graph.py`

## Capabilities

- generation-core

## Impact

- 修改 pipeline.ts + generator.ts（+~60 行）
- 大 notebook 性能 + 正确性双提升
- 无 BREAKING（无 preference 时默认 quality）
