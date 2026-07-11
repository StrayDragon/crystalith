---
depends_on: [c38-align-v2-outputs-pipeline]
batch: all
---

# c42-fix-v2-outputs-contract-alignment — Outputs 响应契约 + citation 持久化对齐

## Why

c38 标 DONE，但 2026-07-11 第三轮深度复核（对照 `backend/py` 源码）发现 c38 的 citation mapping **未真正写入 content 树**，且 POST `/outputs` 的返回值与 v1 `OutputRead` 契约不兼容。存在 2 个 P0 + 5 个 P1：

- **POST 返回 PipelineResult 而非 OutputRead** [P0]: v1 `outputs/api.py:93-103` 返回 snake_case `OutputRead`（`id`/`notebook_id`/`type`/`prompt`/`chunk_ids`/`content`/`created_at`/`updated_at`）。v2 `outputs/router.ts:141` 返回 `PipelineResult`（camelCase `outputId`/`chunkCount`，无 `notebook_id`/`prompt`/`chunk_ids`/时间戳）。任何消费 v1 契约的客户端拿到 `undefined`。
- **citations 未映射进 content 也未持久化** [P0]: v1 `output_graph.py:722-742` 的 `_map_citations` 递归遍历 content 对象，把每个 `citations:[1,3]` 数字数组替换为完整 Citation dict，然后持久化。v2 `pipeline.ts:253-314` 的 `mapCitations` 只构建扁平 `Citation[]` 返回，`sanitizeCitations` 是 no-op；持久化的 content 仍保留裸整数 `[1,2]`。
- **RAG 失败 dump 全量 chunks** [P1]: `pipeline.ts:103-120` 在 retrieveWith 失败时选取 notebook 内全部 chunk（score:0）。违背 c27「检索相关子集」意图；v1 无此兜底，错误直接传播。
- **缺 `_ensure_minimum_content` 字段级兜底** [P1]: v1 `output_graph.py:290-375` 每类型逐字段补默认（GUIDE 的 examples/exercises、MINDMAP 的 children 等）。v2 `pipeline.ts:213-233` 仅做顶层空检查后整体替换为 fallback。
- **JSON export citations 字段不全** [P1]: v1 citation 含 `chunk_index`/`page_number`/`paragraph_index`/`score`；v2 `router.ts:199-204` 缺这些字段。sources 元数据字段名也偏离（`{id,filename,status}` vs `{source_id,source_name,mime_type,parser_type}`）。
- **错误无 422/503 细分** [P1]: v1 `api.py:309-361` 把 ModelConfigurationError→503、schema 校验失败→422、ValueError→400。v2 `router.ts:124` 统一 throw → 500。
- **fallback 内容缺 `_fallback` 标记** [P1]: v1 `output_graph.py:198-287` 所有类型都有结构化 fallback + `_fallback:true` 标记。v2 仅 FAQ/BULLETS/PARAGRAPH/STRUCTURED 有显式处理，其余落到 generic `{title,_error}`。

## What Changes

1. **POST `/outputs` 返回 OutputRead 契约**: 返回 snake_case 实体（含 `id`/`notebook_id`/`prompt`/`chunk_ids`/`content`/`created_at`/`updated_at`）
2. **citation 递归映射并持久化**: 实现 `_map_citations` 等价逻辑——递归遍历 content，把数字索引替换为完整 Citation dict，持久化映射后的 content
3. **RAG 失败传播错误**: 移除 dump 全量 chunks 兜底，让 retrieveWith 失败抛出（对齐 v1）
4. **字段级 postprocess**: `_ensure_minimum_content` 每类型逐字段补默认
5. **export citations/sources 字段补全**: JSON export citations 补全 4 字段；sources 改为 `{source_id,source_name,mime_type,parser_type}`
6. **错误码细分**: 503（model 不可用）/422（schema 校验失败）/400（值错误）
7. **fallback `_fallback` 标记**: 全类型结构化 fallback + 标记

## Capabilities

- generation-core（spec delta: citation 递归映射持久化语义 + postprocess 字段级兜底 + RAG 失败传播）
- output-rendering-and-typing（spec delta: POST 返回 OutputRead 契约 + export citations/sources 字段 + 错误码细分）

## Impact

- **BREAKING（v2 内部）**: POST `/outputs` 响应 shape 从 camelCase PipelineResult 改为 snake_case OutputRead。v2 前端需同步适配。
- citation 从「返回扁平数组」变为「写入 content 树 + 同时返回扁平数组」
- export JSON citations/sources 字段名对齐 v1
