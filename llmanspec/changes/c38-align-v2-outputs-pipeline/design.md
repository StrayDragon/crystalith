# c38 Design — Outputs generation pipeline v1 行为对齐

## v1 行为契约 (SSOT: `backend/py/.../output_graph.py` + `outputs/api.py`)

### source_ids 过滤 (output_graph.py:296-308)

```python
async def retrieve_context(..., source_ids):
    # validate source_ids 属于 notebook
    # vector_search(notebook, query, top_k, min_score, source_ids=source_ids)
```

v2 根因: `RetrieveOptions` 类型 (`rag/registry.ts:112-120`) 只有 `{ topK, minScore }`，无 sourceIds。
searchVectors (`db/vectors.ts:73-93`) 也只按 notebook_id 过滤。

### 5 节点图 (output_graph.py)

```
ResolveContext → GenerateOutput → PostprocessOutput → MapCitations → Persist
```

- **PostprocessOutput** (`output_postprocess.py:349-379`): `ensure_minimum_content`（空内容时 fallback）+ `sanitize_citations_indices`（清理非法索引）
- **MapCitations** (`output_graph.py:722-742`): LLM 输出的 `citations: [1, 2]` 数字索引 → 查回对应 chunk → 构建完整 `Citation[]`
- **fallback** (`output_postprocess.py:15-99`): 生成失败时产出类型化 fallback 内容

### export (api.py:407-476)

```python
export_output(output_id, format="markdown"|"json"):
    if format == "json": return OutputExportJson(citations, sources, exported_at)
    if format == "markdown":
        text = _extract_text_from_output(output)  # 180 行逐类型渲染器 (api.py:515-693)
        return text/markdown + Content-Disposition
```

逐类型渲染器: FAQ→Q/A 列表, TIMELINE→时间线, MINDMAP→嵌套大纲, QUIZ→问答, BRIEFING→结构化摘要, etc.

### convert-to-source (api.py:742-800, 515-739)

```python
convert_to_source(output_id):
    text = _extract_text_from_output(output)  # 逐类型 markdown
    chunks = _split_text_to_chunks(text, 500, 50)  # 段落+句子感知分块
    # embed + create source with chunks
```

## v2 对齐方案

### source_ids 接通

1. `rag/registry.ts`: `RetrieveOptions` 加 `sourceIds?: number[]`
2. `rag/strategies/embed-strategy.ts`: retrieve 按 sourceIds 过滤
3. `db/vectors.ts`: `searchVectors` 支持 sourceIds WHERE（或在应用层 post-filter）
4. `outputs/pipeline.ts`: runOutputPipeline 接受 sourceIds，传给 retrieveWith

### citation mapping

```ts
function mapCitations(llmCitations: number[], chunks: ChunkResult[]): Citation[] {
  // LLM 输出 [1, 2] → chunks[0], chunks[1] → Citation[]
  return llmCitations.map((i) => toCitation(chunks[i - 1])).filter(Boolean);
}
```

### postprocess

```ts
function postprocessOutput(content, citations, chunks) {
  ensureMinimumContent(content); // 空时 fallback
  citations = sanitizeCitationIndices(citations, chunks.length);
  return { content, citations, warnings: [] };
}
```

### export markdown 渲染

实现逐类型渲染器（TS 版），对齐 v1 的 `_extract_text_from_output`。

## 不做的事

- 不改 10 种 output type 的 schema（已在 shared schemas 定义）
- 不改 outputs 的 task queue 分发（c19 已有）
