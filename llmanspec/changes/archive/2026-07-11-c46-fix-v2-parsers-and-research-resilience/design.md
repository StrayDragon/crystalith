# c46 Design — CSV parser + Research 韧性

## v1 行为契约 (SSOT: `backend/py/.../shared/parsers/csv.py` + `features/research/graph.py`)

### CSV parser (csv.py)

```python
class CSVParser:
    max_rows_per_chunk = 50
    max_cell_chars = 200

    def parse(self, content):
        # decode → csv.reader → rows
        # header = rows[0]（空列名 → col{N}）
        # 每 50 行一块 → markdown table
        # metadata: csv_row_start, csv_row_end
        # cell 截断 200 char
```

v2 根因: `parser-registry.ts:9,78` 把 .csv 路由到 textParser pass-through。

### REPORT_SYSTEM_PROMPT (graph.py:94-128)

6 段结构: Executive Summary / Background / Key Findings / Analysis / Recommendations / References。
v2 根因: `agent.ts:508` 一行通用 prompt。

### AI 失败 fallback (graph.py:225,675)

```python
try:
    plan = await generate_plan(...)
except Exception:
    plan = SearchPlan(queries=[topic], ...)  # fallback 2-query
```

v2 根因: `agent.ts:311,358` 直接 break loop → 中止 run。

### export note (api.py:1434-1448)

v1: `type=STRUCTURED`, `content={title, text, metadata:{research_id,...}}`。
v2: `type=BRIEFING`, `content={title, sections}`。

### waiting SSE 心跳 (api.py:1201-1206)

v1: status=waiting_user 时每秒 poll 重发 `waiting`。
v2: 只发一次。

### lock 续期 (api.py:885)

v1: `_extend_lock_periodically` 每 5min。
v2: 无续期，lock TTL 10min。

## v2 对齐方案

### CSV parser

```ts
class CSVParser implements Parser {
  parse(content: Buffer): ParsedChunk[] {
    const rows = parseCSV(content.toString('utf-8'));
    const header = normalizeHeader(rows[0]);
    const chunks = chunkRows(rows, 50); // 50 rows/chunk
    return chunks.map((rows) => ({
      text: toMarkdownTable(header, rows, 200), // cell 截断
      metadata: { csv_row_start, csv_row_end },
    }));
  }
}
```

注册: `parser-registry.ts` 加 `'csv'` → CSVParser。

### report 富 prompt

从 v1 graph.py:94-128 移植 REPORT_SYSTEM_PROMPT 常量。

### AI 失败 fallback

```ts
async function planSearches(...): Promise<SearchPlan> {
  try { return await generateObject({...}); }
  catch { return { queries: [topic], ... }; }  // fallback
}
```

### waiting 心跳

stream loop 中 `if (status === 'waiting_user') emit('waiting', ...)` 每次 poll。

### lock 续期

agent loop 中每 5min `update lockExpiresAt = now + 10min`。

## 不做的事

- 不加 audio/video parser（P1 但依赖 transcription provider，属 c13）
- 不迁移 ToolLoopAgent（延迟改进，post-c13）
