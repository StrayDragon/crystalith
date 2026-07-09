# c26 design — citations 邻域证据审查

## 端点契约

```
GET /v2/notebooks/:nid/citations/context
  ?chunk_id=10              # 方式一：直接定位
  ?source_id=3&chunk_index=5  # 方式二：复合定位
  &neighbors=2              # 可选，0-5，默认 2
```

`chunk_id` 与 (`source_id`+`chunk_index`) **互斥**：同时提供或都不提供 → 400。

## 返回结构

```ts
{
  before: CitationChunk[],  // chunk_index 递增，最多 neighbors 个
  chunk: CitationChunk,     // 目标 chunk
  after: CitationChunk[],   // chunk_index 递增，最多 neighbors 个
}
// CitationChunk = { chunk_id, source_id, chunk_index, text, page_number?, paragraph_index? }
```

## 富化来源

- `page_number` / `paragraph_index`：从 chunks 表对应列取（若 schema 无则从 source metadata 解析）
- `text`：截断到 200 字符（对照 v1 `_to_citation`）

## 对照 v1

`backend/py/src/crystalith/features/citations/api.py:55-133`：

- `_resolve_chunk`（chunk_id 或 source+index）
- `before`/`after` 用 `chunk_index` 范围查询
- `extract_page_number`/`extract_paragraph_index`

v2 复用 chunks 表已有的 `sourceId`/`chunkIndex` 列；page_number 若 v2 schema 缺失则先返回 null（后续补）。
