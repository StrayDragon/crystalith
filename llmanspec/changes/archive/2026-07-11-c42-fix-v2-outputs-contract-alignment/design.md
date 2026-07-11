# c42 Design — Outputs 响应契约 + citation 持久化对齐

## v1 行为契约 (SSOT: `backend/py/.../outputs/api.py` + `output_graph.py`)

### OutputRead 响应契约 (api.py:93-103)

```python
class OutputRead(BaseModel):
    id: int
    notebook_id: int
    type: OutputType
    prompt: str | None
    chunk_ids: list[int] | None
    content: JsonDict
    created_at: datetime
    updated_at: datetime
```

v2 根因: `outputs/pipeline.ts:46-54` 返回 `PipelineResult { outputId, type, content, chunkCount, citations, warnings }` — camelCase + 无 notebook_id/prompt/chunk_ids/时间戳。

### citation 递归映射 (output_graph.py:108-195, 722-742)

```python
def _map_citations(payload, citation_map, fallback):
    # 递归遍历 content dict/list
    # 遇到 key=="citations" 的数组 → 把数字索引替换为完整 Citation dict
    # _resolve_citations(indices, citation_map, fallback)
```

v2 根因: `pipeline.ts:253-314` 的 `mapCitations` 只构建扁平数组，`sanitizeCitations` 是 no-op。content 保留裸整数。

### RAG 失败行为

v1: retrieve_context 失败 → 错误传播 → 请求失败。
v2: `pipeline.ts:103-120` 失败时 dump notebook 全量 chunk (score:0) — 违背检索子集意图。

## v2 对齐方案

### POST 返回 OutputRead

- `pipeline.ts`: runOutputPipeline 返回 `{ row: OutputRow, citations, warnings }`
- `router.ts`: POST handler 返回 `serializeOutput(row)`（已有函数，输出 snake_case）
- citations 通过响应 header 或单独字段附加（不破坏 OutputRead 契约）

### citation 递归映射

```ts
function mapCitationsIntoContent(
  content: unknown,
  citationMap: Map<number, Citation>,
  fallback: Citation[],
): unknown {
  // 递归：dict → 遍历 key，遇到 citations 数组 → _resolveCitations
  //       list → 递归每个元素
  //       primitive → 原样返回
}
```

持久化: `db().update(outputs).set({ content: mappedContent })`

### 字段级 postprocess

```ts
function ensureMinimumContent(content, type) {
  switch (type) {
    case 'guide':
      ensureArray(content, 'examples');
      ensureArray(content, 'exercises');
      break;
    case 'mindmap':
      ensureArray(content, 'children');
      break;
    // ...
  }
}
```

### 错误码细分

- model 不可用 (no chat model) → 503
- generateObject schema 校验失败 → 422
- ValueError (bad params) → 400

## 不做的事

- 不改 output type schemas（已在 shared 定义）
- 不改路径结构（flat `/v2/outputs` 是已确认设计）
