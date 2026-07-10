# c29 design — refine 回退为 citation-aware RAG 摘要器

> 本设计经逐行对照 v1 实现（2026-07-10 verify pass）修正。所有 v1 行为细节均标注源文件:行号。

## 对照 v1 行为契约

### v1 参考文件

| v1 文件                            | 内容                                                                                |
| :--------------------------------- | :---------------------------------------------------------------------------------- |
| `features/refine/api.py`           | 端点 + 请求/响应模型 + FORMAT_PROMPTS + _apply_format + _fallback_structured + 校验 |
| `features/tasks/worker.py:154-264` | `_execute_refine`（单格式经队列的实际执行）                                         |
| `shared/utils/text.py:23-30`       | `parse_bullets`                                                                     |
| `shared/utils/context.py:13-24`    | `format_context`                                                                    |
| `shared/utils/chunk.py`            | `extract_page_number` / `extract_paragraph_index`                                   |
| `shared/config/models.py:525-527`  | `RefineSettings.formats` 默认 `["paragraph","bullets","structured"]`                |
| `shared/schemas/citations.py`      | Citation 模型                                                                       |

### 单格式 refine（v1 `POST /v1/.../refine` → 任务队列 → `_execute_refine`）

```
请求: { prompt, format: paragraph|bullets|structured, source_ids?, top_k=5, min_score=0.2 }
  │
  ├─ prompt 校验: worker.py:165 .strip() 后非空（空→ValueError→task fail）
  ├─ format 校验: normalize(lowercase+strip) + allowed-set（非法→400）
  ├─ source_ids 校验: 去重(dict.fromkeys) + int cast + >0 check + DB存在性（→400）
  │
  ├─ 无 source_ids → citations=[], context="", evidence=false
  │
  └─ 有 source_ids →
       ① embed prompt（limiters.embedding.acquire）
       ② 若 embeddings 为空 → citations=[], context="", evidence=false
       ③ 向量检索 top-k（limiters.vector_search.acquire）
          - 按 source_ids 过滤
          - min_score 过滤
       ④ 若 results 为空 → citations=[], context="", evidence=false
       ⑤ 构建 citations（见下方"Citation 构建"）
       ⑥ 构建 context（见下方"format_context"）
  │
  ⑦ LLM 生成（limiters.llm_generate.acquire）
  ⑧ applyFormat
  │
响应: { format, paragraph?, bullets?, structured?, citations, evidence, created_at }
```

### 批量 refine（v1 `POST /v1/.../refine/batch`，不经队列）

```
请求: { prompt, formats?: string[], source_ids?, top_k=5, min_score=0.2 }
  │
  ├─ formats 为 null → 默认全部 3 格式（RefineSettings.formats）
  ├─ 检索+citations+context 只做一次（共享，逻辑同单格式 ①-⑥）
  └─ formats 并发生成（Semaphore(3)），每个格式独立 LLM 调用，共享同一 context+citations
  │
响应: { outputs: { [format]: {paragraph?, bullets?, structured?} }, citations, evidence, created_at }
```

### 关键 v1 细节（逐项，含源文件:行号）

#### FORMAT_PROMPTS（api.py:91-98 / worker.py:94-101，**完整原文**）

```python
"paragraph": "Summarize the sources into one concise paragraph."
"bullets": "Summarize the sources into bullet points (each on a new line)."
"structured": "Return JSON with keys: title (string), bullets (list of strings), terms (list of strings). Keep bullets concise."
```

#### LLM 消息构建（api.py:155-166 / worker.py:55-66）

- system: `"You are a research assistant. Answer strictly using the provided sources. " + FORMAT_PROMPTS[format]`
- user: `"Prompt:\n{prompt}\n\nSources:\n{context}"`
- 注：worker.py 用 stripped prompt 构建消息（worker.py:165 先 strip）

#### format_context（utils/context.py:13-24，**完整原文**）

```python
def format_context(results, chunk_map) -> str:
    blocks = []
    for index, result in enumerate(results, start=1):  # 1-based 编号
        chunk, source = chunk_map[result.entry.chunk_id]
        blocks.append(f"[{index}] Source: {source.filename} (chunk {chunk.chunk_index})\n{chunk.text}")
    return "\n\n".join(blocks)
```

关键：**完整未截断的 chunk.text**（非 snippet），`[N] Source: <filename> (chunk <raw_index>)` 模板，`\n\n` 连接。

#### Citation 构建（api.py:286-301 batch / worker.py:231-244 single）

```python
citation = Citation(
    source_id=source.id,
    source_name=source.filename,
    chunk_id=chunk.id,
    chunk_index=chunk.chunk_index,        # worker: 0-based; api.py batch: +1（v1 自身不一致）
    page_number=extract_page_number(chunk),  # api.py batch 有; worker single 无（v1 自身不一致）
    paragraph_index=extract_paragraph_index(chunk),  # 同上
    snippet=chunk.text.strip()[:200],     # 先 strip 再截 200
    score=result.score,
)
```

**v2 决策**：

- chunk_index 统一 0-based（与 v2 QA 对齐）
- snippet：**先 `.trim()` 再 `slice(0,200)`**（修正 resolveCitations 缺 strip 的缺口）
- page_number/paragraph_index：v2 `RetrievedChunk` 当前无此字段。本 change 从 chunk metadata 提取（若存在），否则 null。**c29 必须实现 extractPageNumber/extractParagraphIndex**（对照 `utils/chunk.py`，从 `chunk.metadata.page` / `chunk.metadata.paragraph_index` 取）。

#### parse_bullets（utils/text.py:23-30，**完整原文**）

```python
def parse_bullets(text: str) -> list[str]:
    items = []
    for raw in text.splitlines():
        cleaned = raw.strip().lstrip("-").strip()  # 仅剥离前导 "-"，不匹配 •/*/数字
        if cleaned:
            items.append(cleaned)
    return items
```

⚠️ **关键修正**：v1 的 parse_bullets **只剥离前导 `-`**，处理**所有非空行**。不匹配 `•`/`*`/数字前缀。此前 design 的描述完全错误。

#### _apply_format（api.py:169-191 / worker.py:74-91）

- paragraph → `answer.strip()`
- bullets → `parse_bullets(answer)`（上方原文）
- structured → `JSON.parse` 成功时**显式构造**（非 spread）：
  ```python
  StructuredRefine(
      title=str(parsed.get("title", "")),         # 默认 ""，强制 str
      bullets=[str(item) for item in parsed.get("bullets", [])],  # 默认 []，强制 str
      terms=[str(item) for item in parsed.get("terms", [])],      # 同上
      citations=citations,
  )
  ```
  JSON 解析失败 → `_fallback_structured`

#### _fallback_structured（api.py:103-110 / worker.py:40-45）

```python
title = prompt.strip()[:48] or "Refine"   # 先 strip 再截 48
bullets = [citation.snippet for citation in citations[:5]]
terms = []
# citations 字段附上
```

#### source_ids 校验（api.py:127-152 / worker.py:105-129）

1. `_normalize_source_ids`：`int()` cast → `<=0` 检查（→ 400 "Unknown source_id"）→ `dict.fromkeys()` 去重
2. `_validate_source_ids`：DB 查 notebook 内存在的 source_ids → 缺失则 400/ValueError

#### 错误处理（api.py）

- notebook 不存在 → 404 "Notebook not found"
- format 非法 → 400 "Unsupported refine format"
- source_ids 含未知 → 400 "Unknown source_id in source_ids"
- 单格式 task cancelled → **409** "Task cancelled"（非 404）
- 单格式 task failed → **500** task.error

## v2 实现方案

### ⚠️ 关键约束：source_ids 过滤

v2 RAG `RetrieveOptions`（rag/types.ts）**不支持 sourceIds 过滤**。v1 `vector_store.search(source_ids=...)` 在 DB 层过滤。

**方案：后过滤**。retrieveForRefine 在 retrieve 返回结果后，按 `sourceIds` 过滤 `ChunkResult.source_id`。不修改 RAG 接口（避免影响 c16 foundations）。代价：over-fetch（检索 top_k*N 个 source 后过滤），但 refine 场景 source_ids 通常 ≤ 几个，可接受。

### router.ts（重写）

```ts
// 单格式 refine — 经任务队列
.post('/refine', async ({ body, set }) => {
  const { prompt, format, source_ids, top_k, min_score } = body as RefineRequest;

  // ① notebook 存在性 → 404
  // ② format 校验 → 400 "Unsupported refine format"
  // ③ source_ids 校验（normalize + >0 + 存在性）→ 400

  const taskId = taskQueue.enqueue({ type: 'refine', notebookId, payload: { refineInput: {...} }, priority: 1 });
  try {
    return await taskQueue.waitForCompletion(taskId);  // RefineResponse 形状
  } catch (error) {
    if (error.message === 'Task cancelled') { set.status = 409; return { detail: 'Task cancelled' }; }
    set.status = 500; return { detail: String(error) };
  }
})

// 批量 refine — 直接并发（不经队列，v1 batch 不经队列）
.post('/refine/batch', async ({ body, set }) => {
  const { prompt, formats, source_ids, top_k, min_score } = body as RefineBatchRequest;
  // ① notebook + format + source_ids 校验（同上）
  // ② formats 为 null → 默认 ['paragraph','bullets','structured']
  // ③ retrieveForRefine 一次 → citations + context + evidence
  // ④ formats 并发（Semaphore(3)）→ 各自 LLM + applyFormat
  // ⑤ 返回 { outputs: { [format]: FormatOutput }, citations, evidence, created_at }
})

// 模式列表
.get('/refine/modes', () => [
  { id: 'paragraph', name: '段落摘要' },
  { id: 'bullets', name: '要点摘要' },
  { id: 'structured', name: '结构化提取' },
])
```

### worker.ts handleRefine（重写）

```ts
async function handleRefine(payload, signal, limiters): Promise<RefineResult> {
  const { prompt, format, source_ids, top_k, min_score } = payload.refineInput;
  const trimmedPrompt = prompt.trim(); // worker.py:165
  if (!trimmedPrompt) throw new Error('Refine task requires a prompt');

  // ① 检索 + citations + context
  const { citations, context, evidence } = await retrieveForRefine(
    notebookId,
    trimmedPrompt,
    source_ids,
    top_k,
    min_score,
    signal,
    limiters,
  );

  // ② LLM 生成
  const releaseLlm = await limiters.llmGenerate.acquire();
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const messages = buildRefineMessages(format, trimmedPrompt, context);
    const { generateText } = await import('ai');
    const result = await generateText({
      model,
      system: messages.system,
      prompt: messages.user,
      abortSignal: signal,
    });
    var answer = result.text;
  } finally {
    releaseLlm();
  }

  // ③ applyFormat
  return {
    format,
    ...applyFormat(format, answer, trimmedPrompt, citations),
    citations,
    evidence,
    created_at: new Date().toISOString(),
  };
}
```

### retrieveForRefine（新建 `refine/retrieve.ts`）

```ts
export async function retrieveForRefine(
  notebookId,
  prompt,
  sourceIds,
  topK,
  minScore,
  signal,
  limiters,
): Promise<{ citations; context; evidence }> {
  if (!sourceIds?.length) return { citations: [], context: '', evidence: false };

  // ① embed + 检索（embedding limiter）
  const releaseEmbed = await limiters.embedding.acquire();
  let results: ChunkResult[];
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    // 检索（over-fetch 补偿后过滤：topK * sourceIds.length）
    const fetchK = topK * sourceIds.length;
    results = await ragRegistry
      .get('embed')
      .retrieve(prompt, notebookId, { topK: fetchK, minScore });
  } finally {
    releaseEmbed();
  }

  // ② 后过滤 source_ids
  const idSet = new Set(sourceIds);
  results = results.filter((r) => idSet.has(r.source_id)).slice(0, topK);

  if (!results.length) return { citations: [], context: '', evidence: false };

  // ③ 构建 RetrievedChunk（带完整 text 供 context 用）
  const retrieved = await hydrateChunks(results); // DB 查 chunk.text + source.filename

  // ④ citations（先 strip 再 slice 200 + page/paragraph 提取）
  const citations = retrieved.map((c) => ({
    source_id: c.source_id,
    source_name: c.source_name,
    chunk_id: c.chunk_id,
    chunk_index: c.chunk_index, // 0-based
    snippet: c.text.trim().slice(0, 200),
    page_number: extractPageNumber(c.metadata),
    paragraph_index: extractParagraphIndex(c.metadata),
    score: c.score,
  }));

  // ⑤ context（完整未截断 text）
  const context = retrieved
    .map((c, i) => `[${i + 1}] Source: ${c.source_name} (chunk ${c.chunk_index})\n${c.text}`)
    .join('\n\n');

  return { citations, context, evidence: true };
}
```

### applyFormat + 辅助函数（新建 `refine/format.ts`）

```ts
const FORMAT_PROMPTS = {
  paragraph: 'Summarize the sources into one concise paragraph.',
  bullets: 'Summarize the sources into bullet points (each on a new line).',
  structured:
    'Return JSON with keys: title (string), bullets (list of strings), terms (list of strings). Keep bullets concise.',
};

function buildRefineMessages(format, prompt, context) {
  return {
    system: `You are a research assistant. Answer strictly using the provided sources. ${FORMAT_PROMPTS[format]}`,
    user: `Prompt:\n${prompt}\n\nSources:\n${context}`,
  };
}

function applyFormat(format, answer, prompt, citations) {
  switch (format) {
    case 'paragraph':
      return { paragraph: answer.trim() };
    case 'bullets':
      return { bullets: parseBullets(answer) };
    case 'structured':
      try {
        const parsed = JSON.parse(answer);
        return {
          structured: {
            title: String(parsed.title ?? ''),
            bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map(String) : [],
            terms: Array.isArray(parsed.terms) ? parsed.terms.map(String) : [],
            citations,
          },
        };
      } catch {
        return { structured: fallbackStructured(prompt, citations) };
      }
  }
}

// 对照 v1 utils/text.py:23-30：逐行 strip + lstrip("-") + strip，仅保留非空
function parseBullets(text: string): string[] {
  const items: string[] = [];
  for (const raw of text.split('\n')) {
    const cleaned = raw.trim().replace(/^-+/, '').trim();
    if (cleaned) items.push(cleaned);
  }
  return items;
}

function fallbackStructured(prompt: string, citations) {
  return {
    title: prompt.trim().slice(0, 48) || 'Refine',
    bullets: citations.slice(0, 5).map((c) => c.snippet),
    terms: [],
    citations,
  };
}

// 对照 v1 utils/chunk.py:11-22
function extractPageNumber(metadata: unknown): number | null {
  if (metadata && typeof metadata === 'object' && 'page' in metadata) {
    return Number((metadata as Record<string, unknown>).page) || null;
  }
  return null;
}
function extractParagraphIndex(metadata: unknown): number | null {
  if (metadata && typeof metadata === 'object' && 'paragraph_index' in metadata) {
    return Number((metadata as Record<string, unknown>).paragraph_index) || null;
  }
  return null;
}
```

## 不做（out of scope）

- 不改前端（c35 统一迁移）
- 不引入 pydantic-graph（v1 batch 是直接并发，v2 用 Promise.all + Semaphore）
- 不修改 RAG `RetrieveOptions` 接口（source_ids 后过滤，避免影响 c16）
- 不做 format 可配置化（v1 RefineSettings.formats 可配，v2 硬编码 3 格式；配置层是 c25 范围）

## 迁移边界

| 方面          | 旧（当前 v2）                                   | 新（本 change）                                                                |
| :------------ | :---------------------------------------------- | :----------------------------------------------------------------------------- |
| 请求体        | `{text, mode, ...}`                             | `{prompt, format, source_ids, top_k(1-20), min_score(0-1)}`                    |
| 响应体        | `{mode, original_length, refined_length, text}` | `{format, paragraph?, bullets?, structured?, citations, evidence, created_at}` |
| 模式集        | expand/summarize/rewrite/translate/structured   | paragraph/bullets/structured                                                   |
| 检索          | 无（全 chunk 拼接或字面 text）                  | embed prompt → 向量检索 top-k → source_ids 后过滤                              |
| citations     | 无                                              | 有（hydrate source_name + strip+snippet200 + page/paragraph）                  |
| context       | 无                                              | `[N] Source: <filename> (chunk <idx>)\n<full text>`，`\n\n` 连接               |
| batch         | 无                                              | `POST /refine/batch`（共享检索 + Semaphore(3) 并发）                           |
| parse_bullets | N/A                                             | 逐行 strip + lstrip("-") + strip（**不匹配 •/\*/数字**）                       |
| 错误码        | NotFoundError 笼统                              | 404 nb / 400 format+source / 409 cancel / 500 fail                             |

## 验证

- 更新 `test/refine/queue.test.ts`：请求 {prompt, format, source_ids}；断言 format/citations/evidence；source_ids 校验 400；cancel 409
- 新增 `test/refine/citation-aware.test.ts`：seed source+chunk → refine → 断言 citations 非空 + evidence=true + snippet strip
- 新增 `test/refine/batch.test.ts`：batch 3 格式 → 共享 citations + outputs 含 3 key
- 新增 `test/refine/parse-bullets.test.ts`：parseBullets 逐行 strip + lstrip("-") 行为（对照 v1）

## v1 内部不一致（本 change 选择记录）

| 点                          | v1 batch (api.py)   | v1 single (worker.py) | v2 选择                |
| :-------------------------- | :------------------ | :-------------------- | :--------------------- |
| chunk_index                 | +1（1-based）       | 0-based               | 0-based（与 QA 对齐）  |
| page_number/paragraph_index | 有                  | 无                    | 有（从 metadata 提取） |
| evidence 默认               | true→false on empty | false→true on results | citations.length > 0   |
| created_at                  | datetime 对象       | ISO 字符串            | ISO 字符串             |
| prompt strip                | 原文                | .strip() 后           | .strip() 后            |
