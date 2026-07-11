# c43 Design — Studio SSE 流式 + RAG 检索对齐

## v1 行为契约 (SSOT: `backend/py/.../studio/api.py` + `generator.py` + `storage.py`)

### SSE 流式生成 (api.py:353-560)

```python
@router.get("/drafts/{slide_id}/outline/stream")
async def generate_outline_stream(...):
    async def event_stream():
        yield _sse_event("progress", {"stage":"outline", "progress":5})
        # ... 生成过程 ...
        yield _sse_event("toolcall", {...})
        yield _sse_event("done", {"slide_id":..., "outline":...})
        yield _sse_event("error", {...})  # 失败时
```

事件: `progress` / `toolcall` / `busy` / `done` / `error`

v2 根因: `studio/router.ts:268,338` 改为 POST 返回 JSON。v2 已有 SSE 工具（`ai/stream.ts`），studio 未用。

### RAG 检索 (generator.py:293-362 + context.py)

v1 studio 生成走 `retrieve_context`（embed→KNN→fusion→diversity→token budget）。
v2 根因: `studio/router.ts:126-142` 的 `getContext()` 直接 join chunks+sources 后 `.slice(0,6000)`。其它域（qa/outputs/refine）都用 `ragRegistry.retrieveWith`。

### drafts/latest (api.py:232-247)

按 `updated_at desc` 取 notebook 下最新 draft。

### stale-RUNNING (api.py:51,107-118)

`SLIDE_RUNNING_STALE_AFTER = 10min`；并发生成返回 busy 事件。

### theme presets (config.py:74-123)

6 个 preset，含 theme/colorSchema/fonts{sans,serif,mono}/transition/background/class。

### frontmatter 确定性 (generator.py:150-170)

```python
def _strip_frontmatter(md): ...  # 移除 LLM 生成的 frontmatter
def _apply_frontmatter(md, preset): ...  # 确定性 apply preset frontmatter
```

## v2 对齐方案

### SSE 端点

- 新增 `GET /studio/slides/:id/outline/stream` + `/markdown/stream`
- 复用 `ai/stream.ts` 的 SSE helper
- 事件: progress/toolcall/busy/done/error
- 现有 POST 保留为非流式别名

### getContext 接入 ragRegistry

```ts
const results = await ragRegistry.retrieveWith('embed', {
  notebookId,
  sourceIds: slide.sourceIds,
  topK: 20,
  minScore: 0.3,
});
const context = results.chunks.map((c) => c.text).join('\n\n');
```

### theme presets 对齐

从 v1 `config.py:74-123` 移植 6 个 preset 定义。

### frontmatter strip+apply

```ts
function stripFrontmatter(md: string): string {
  /* regex remove ---\n...\n--- */
}
function applyFrontmatter(md: string, preset: ThemePreset): string {
  const fm = buildFrontmatter(preset);
  return `${fm}\n${md}`;
}
```

## 不做的事

- 不引入 SlidesWorkflowPlugin 抽象（c13 范畴）
- 不改 SlideDraftRead schema
