# c39 Design — Sources + Sessions v1 行为对齐

## P0 竞态修复 (2 处)

### QA-to-source (`source-extras.router.ts:246-251`)

```ts
// 当前 (BUG):
catch (e) {
  db().update(sources).set({ status: 'failed' })...
}
db().update(sources).set({ status: 'ready' })...  // 无条件！覆盖 failed

// 修复:
try {
  await triggerEmbedding(...)  // c30 模式
  db().update(sources).set({ status: 'ready' })...
} catch (e) {
  db().update(sources).set({ status: 'failed', errorCode: 'EMBEDDING_FAILED' })...
  return  // 不设 ready
}
```

### sessions convert-to-source (`router.ts:249-256`)

同上模式修复。

## dedup 默认对齐

v1: `dedup_action` 默认 `'prompt'`（`api_ingest.py:313`）
v2: 默认 `'create_new'`（`router.ts:179,451`）→ 改为 `'prompt'`

v1 还有 config gate: `settings.source_ingestion.dedup.enabled`（默认 true）
v2 无此 gate → 暂不实现 config 解析（那是 c40 范围），仅对齐默认 action。

## tag 校验 (对齐 v1 `api_tags.py`)

| 操作   | v1 校验                                                  | v2 需补    |
| :----- | :------------------------------------------------------- | :--------- |
| create | 名称唯一性（case-insensitive）409 + normalize/trim/max64 | 唯一性检查 |
| update | 唯一性 409 + notebook 归属校验                           | 两项都补   |
| delete | notebook 归属校验                                        | 补         |
| assign | source 存在 + 幂等（已 assigned 返回提示）               | 补         |
| remove | source 存在 + 幂等（未 assigned 返回提示）               | 补         |

## per-source QA 向量检索 (对齐 v1 `api_qa.py:82-119`)

```ts
// 当前 (降级): 取前 15 chunk
// 修复: embed question + vector search scoped to source
const queryVector = await embed(question);
const results = await searchVectors({
  notebookId,
  queryVector,
  topK: 5,
  minScore: 0.1,
  sourceIds: [sourceId],
});
// fallback: 无命中才取前 N chunk
```

## from-url link 模式 (对齐 v1 `api_ingest.py:379-391`)

```ts
if (mode === 'link') {
  // 不 fetch，创建轻量 source: URL + title + snippet 作为单 chunk
  const source = createSource({ url, filename: title ?? url, parserType: 'link' });
  // 单 chunk = snippet 或 title
}
```

## SSRF fallback 修复

```ts
// 当前 (BUG): router.ts:495 fallback fetch 不校验
// 修复: fallback 也走 validateUrlForFetch
await validateUrlForFetch(url); // 已在 :455 校验过，但 fallback 路径需再确认
```

实际上 fallback fetch 的是同一 URL，问题在于 validateUrlForFetch 在初次校验后、fallback 前 URL 可能被改变（或代码路径绕过）。修复方式：将 fallback fetch 包在同一 SSRF guard 内。

## sessions 补全

| 缺项               | v1 参考        | v2 修复                                             |
| :----------------- | :------------- | :-------------------------------------------------- |
| GET 单个 session   | api.py:200-209 | 新增 GET /v2/notebooks/:nid/sessions/:sid           |
| notebook 归属校验  | api.py:78-87   | PATCH/DELETE/convert 校验 session.notebookId == nid |
| convert 201        | api.py:242,398 | set.status = 201                                    |
| citation→chunk_ids | api.py:491-500 | convert-to-output 从 citations 收集 chunk_ids       |

## 不做的事

- list sources 的缓存层（Redis epoch）— 暂不需要（v2 无 Redis）
- extractors 的可用性诊断 — 复杂度高，推到后续
- CSV 专用 parser — 推到 c14 或独立
