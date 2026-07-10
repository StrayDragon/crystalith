---
depends_on: [c24-add-v2-pipeline-integration, c27-add-v2-outputs-rag-retrieval]
batch: all
---

# c38-align-v2-outputs-pipeline — Outputs generation pipeline v1 行为对齐

## Why

c27 (outputs-rag) 标 DONE，但 2026-07-10 v1↔v2 对拍发现 c27 的核心目标——source_ids 过滤——根本没接通。outputs 管线存在 3 个 P0 + 3 个 P1：

- **source_ids 完全被忽略** [P0]: v1 `output_graph.py:296-308` 按 source_ids 过滤检索。v2 `outputs/pipeline.ts:87` — `RetrieveOptions` 类型无 sourceIds 字段，检索范围是整个 notebook。c27 加了 RAG 调用但没把 source_ids 接进检索链。
- **缺 postprocess / citation mapping / fallback** [P0]: v1 5 节点图（ResolveContext→Generate→Postprocess→MapCitations→Persist），`output_graph.py:722-742` 把数字 citation 索引映射成完整对象。v2 `pipeline.ts:122-177` 只调 generateObject 然后 dump，LLM 的 `citations:[1,2]` 留为裸整数，citation 是全部检索 chunk 而非 LLM 选的子集。
- **export 忽略 format 参数 + 无 markdown 渲染** [P0]: v1 `api.py:407-476` 支持 `?format=markdown|json`，markdown 路径有 180 行逐类型渲染器。v2 `router.ts:138-151` 不读 query.format，返回 flat JSON。
- **convert-to-source 用 raw JSON** [P1]: v1 `_extract_text_from_output` (api.py:515-693) 逐类型 markdown 渲染 + 500/50 分块。v2 `router.ts:154-196` JSON.stringify 成单 chunk。
- **缺 model_id/top_k/min_score 请求字段** [P1]: v1 `OutputGenerateRequest` 支持这些。v2 只读 preference，hardcoded PREF_TOPK。
- **缺 plugin-gating + SLIDES guard** [P2]: v1 拒绝 SLIDES 400 + 插件缺失 409。v2 无检查。

## What Changes

1. **source_ids 接通检索链**: RetrieveOptions 类型加 sourceIds，pipeline 传 source_ids 到 ragRegistry retrieve 过滤
2. **citation mapping**: 把 LLM 输出的数字 citation 索引映射回完整 Citation 对象（非全部 chunk）
3. **postprocess**: 实现 `ensure_minimum_content` + `sanitize_citations_indices` + fallback 内容
4. **export format**: 实现 `?format=markdown|json`，markdown 路径逐类型渲染
5. **convert-to-source**: 逐类型 markdown 渲染 + 分块
6. **请求字段**: 补 model_id/top_k/min_score

## Capabilities

- generation-core (spec delta: outputs 管线 postprocess + citation mapping 语义)
- output-rendering-and-typing (spec delta: export markdown 渲染 + convert-to-source 渲染)
- source-aware-generation-modes (spec delta: source_ids 过滤在 outputs 路径)

## Impact

- outputs 检索从全 notebook 收窄到用户指定 source 子集
- citation 从"全部 chunk"变为"LLM 选的子集"
- export 支持 markdown 格式
