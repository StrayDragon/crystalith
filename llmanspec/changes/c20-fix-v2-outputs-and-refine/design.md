# c20 design — 输出与精炼对齐

## 补 3 种 core output generator

v1 `output_schemas.py:43-89` 定义了 PARAGRAPH/BULLETS/STRUCTURED 的 pydantic schema。v2 `packages/shared/src/schemas/output.ts:149-166` 已有对应 Zod schema，但 `generator.ts` 的 OUTPUT_META 缺这 3 项。

```ts
// generator.ts — 补 3 项
PARAGRAPH: { type: 'PARAGRAPH', is_tool: false, prompt: 'Generate a coherent paragraph...' },
BULLETS: { type: 'BULLETS', is_tool: false, prompt: 'Generate a bullet-point summary...' },
STRUCTURED: { type: 'STRUCTURED', is_tool: false, prompt: 'Generate structured JSON {title, bullets[], terms[]}...' },
```

generateObject 用 `OutputContentSchemaByType[type]`（shared 已定义），无需额外 schema。

## 后处理（移植 v1 output_postprocess.py）

```ts
// postprocess.ts
export function postprocessOutput(content: any, type: OutputType, citations: Citation[]): any {
  // 1. ensure_minimum_content: 缺字段填 fallback
  // 2. sanitize_citations_indices: clamp 到 [1, citations.length]，去重
  // 3. quality preference 时可选 repair（二次 LLM 调用）
}
```

## convert-to-source embed 修复

当前 `router.ts:153-190` 转换后只插 sources + chunks 行，不 embed。修复：

```ts
// convert-to-source 后
await embedder.embedSingle(chunkText); // 生成向量
insertVector(db(), chunkId, embedding, notebookId, sourceId); // 写 vec_chunks
```

## refine source_ids bug 修复

当前 `refine/router.ts:85-94` 查询：

```ts
where(eq(chunks.notebookId, notebookId)); // ❌ 忽略 sourceIds
```

修复：

```ts
where(and(eq(chunks.notebookId, notebookId), inArray(chunks.sourceId, sourceIds)));
```

## refine 格式对齐 v1

v1 refine 3 格式：paragraph/bullets/structured(JSON {title, bullets[], terms[]})。
v2 当前 4 模式：expand/summarize/rewrite/translate。

**决策**：v2 保留 4 模式（比 v1 更灵活），但补 v1 的 structured 格式（返回 JSON {title, bullets[], terms[]}）。即 modes = expand/summarize/rewrite/translate/structured。

## 验证

- outputs BDD：PARAGRAPH/BULLETS/STRUCTURED 不再 throw
- refine 单元测试：source_ids 过滤正确、structured 格式
