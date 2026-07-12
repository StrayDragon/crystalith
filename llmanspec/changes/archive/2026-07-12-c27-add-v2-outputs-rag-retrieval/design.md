# c27 design — outputs 生成接入 RAG 检索

## 当前问题

`pipeline.ts:38-63`：`getContext(notebookId, chunkIds?)` → 若无 chunkIds 则 `SELECT text FROM chunks WHERE notebookId` **全量 dump**。500 chunk 的 notebook 会把 ~20 万 token 灌进 prompt。

## 改造

```ts
// pipeline.ts
async function getContext(notebookId, query, preference, chunkIds?) {
  if (chunkIds) return getChunksByIds(chunkIds); // 显式选择保留
  const topK = preference === 'speed' ? 3 : 10;
  return ragRegistry.retrieveWith('embed', notebookId, query, topK);
}
```

`query` 由 output 类型 + 主题构造（如 FAQ → "常见问题 " + 主题）。

## 偏好调优

| preference     | topK | 用途                        |
| -------------- | ---- | --------------------------- |
| quality (默认) | 10   | 覆盖广，适合 BRIEFING/GUIDE |
| speed          | 3    | 快，适合实时预览            |

## Citations

检索返回的 chunk → 转 Citation（复用 qa 的 resolveCitations）附到 OutputResult。

## 对照 v1

`shared/agents/output_graph.py`：retrieve→generate→repair 三节点。v2 用 generateObject 单步（AI SDK v7 原生重试替代 repair 循环），本 change 只补 retrieve + citations，不引入 graph。

## 不做

- 不重做 schema 修复循环（generateObject 原生重试足够）
- 不改 output 类型集合（10 types 不变）
