---
depends_on: [c16-fix-v2-rag-foundations]
blocks: [c13-add-v2-distribution, c14-add-v2-cleanup-delivery]
batch: all
---

# c17-fix-v2-qa-citations — QA 引用修复

## Why

`docs/V1-V2-DRIFT-ANALYSIS.md` P0-1 揭示：v2 QA 的 `citations` 永远是 `[]`。根因是 `features/qa/handler.ts:94` 的 `retrievedChunks` 声明后**无人写入**——retrieveSources 工具的 execute 返回结果，但 streamText 的 fullStream 没有捕获并回填。这是 Crystalith 核心 RAG 卖点（问答带证据来源）的致命缺陷，前端引用展示完全失效。

同时 QA 硬编码 `new EmbedStrategy()` 绕过 `ragRegistry`，用户配置的 per-notebook 策略对 QA 无效。

## What Changes

- **MODIFIED** `apps/server/src/features/qa/handler.ts` — streamText fullStream 捕获 `tool-result` 事件，回填 retrievedChunks；复用 `ai/tools/retrieve-sources.ts`（正确 hydrate source_name）替换内联简化版
- **MODIFIED** `apps/server/src/features/qa/handler.ts` — QA 接入 `ragRegistry.getForNotebook()`，honors `strategy_id` 请求参数（不再硬编码 EmbedStrategy）
- **NEW** `apps/server/src/features/qa/confidence.ts` — 置信度计算（移植 v1 `service.py:79`：`(similarity_avg + coverage_ratio + citation_ratio) / 3`）
- **MODIFIED** `apps/server/src/ai/stream.ts` — done 事件携带 confidence 字段
- **MODIFIED** `apps/server/src/features/qa/handler.ts` — 无证据时返回 v1 的本地化提示（"请先选择至少一个来源"等，见 v1 `service.py:62`）

## Capabilities

- evidence-review-workflow (spec delta: QA 引用生成与置信度)

## Impact

- QA 响应的 `citations` 数组非空，包含完整 Citation 对象（source_id/source_name/chunk_id/chunk_index/snippet/score）
- 前端问答界面可显示证据来源块
- 置信度字段辅助 UI 展示可信度
