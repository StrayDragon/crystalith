# c17 design — QA 引用修复

## bug 根因

`handler.ts:94` 声明 `const retrievedChunks = []`，retrieveSources 工具 execute 返回结果但**没有捕获机制**。`citationsResolver: () => resolveCitations(retrievedChunks)` 拿到空数组。

AI SDK `streamText` 的 `fullStream` 会发射 `tool-result` 事件（含 toolName + result）。v2 当前只监听 `text-delta` 和 `error`（`stream.ts:67-78`），丢弃了 tool-result。

## 修复方案

### 1. 捕获 tool 结果回填 retrievedChunks

```ts
// handler.ts — streamQa 内
for await (const part of result.fullStream) {
  if (part.type === 'tool-result' && part.toolName === 'retrieveSources') {
    retrievedChunks.push(...part.result); // 回填
  }
  // ... 其他 part 处理
}
```

或：retrieveSources 工具 execute 内部直接 push 到外部 captured 数组（闭包）。

### 2. 复用 ai/tools/retrieve-sources.ts

`ai/tools/retrieve-sources.ts:28` 的 `retrieveSourcesTool` 工厂已正确实现：

- hydrate source_name（查 sources 表）
- distance→similarity 转换（L2→similarity）
- 返回完整 Citation 形状

替换 handler.ts 内联的简化版（只返回 chunk_id/source_id/page/text/score，无 source_name）。

### 3. 接入 ragRegistry

```ts
// handler.ts — 不再硬编码
const strategyId =
  opts.strategyId ?? (await ragRegistry.getForNotebook(opts.notebookId))?.strategyId ?? 'embed';
const strategy = ragRegistry.get(strategyId); // 支持 hybrid/keyword/page-index
```

### 4. 置信度计算（移植 v1 service.py:79）

```ts
// confidence.ts
export function computeConfidence(
  citations: Citation[],
  notebookSourceCount: number,
  topK: number,
): number {
  const similarity_avg = avg(citations.map((c) => c.score));
  const coverage_ratio = uniqueSources(citations) / notebookSourceCount;
  const citation_ratio = Math.min(1, citations.length / topK);
  return clamp((similarity_avg + coverage_ratio + citation_ratio) / 3, 0, 1);
}
```

### 5. 无证据本地化提示

v1 `service.py:62` 按原因返回不同中文提示（no_sources/no_vector_hits/no_valid_chunks）。v2 复刻。

## 验证

- QA BDD scenario：citations 非空（需取消 skip qa 域，或新增单元测试）
- 单元测试：retrievedChunks 回填、source_name hydrate、置信度计算
