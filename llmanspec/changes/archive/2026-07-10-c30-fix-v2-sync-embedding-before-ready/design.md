# c30 design — 同步 embedding:ready 前向量必须写入

## 对照 v1 行为契约

v1 `api_ingest.py:upload_source`（:809-887）序列：

```
1. insert source status=PROCESSING + commit
2. parse (run_in_executor)
3. embed_batch
4. insert chunk rows + flush
5. source.status = READY + commit          ← 先标 ready
6. await vector_store.add(...)             ← 再写向量（但在 return 前）
7. invalidate cache + return 201
```

关键：step 5-6 在同一个 `await` 链中，HTTP 响应（step 7）在向量写入（step 6）完成后才返回。加上检索的 status gate，竞态窗口对外不可见。

## v2 当前缺陷

### pipeline.ts（upload 路径）

```ts
// 5. Mark ready                                    ← 先标 ready
db().update(sources).set({ status: 'ready', ... }).run();

// 6. Trigger embedding (fire-and-forget)           ← 异步，不 await
triggerEmbedding(sourceRow.id, sourceRow.notebookId).catch(...)
// 7. return { status: 'ready' }                    ← 立即返回，向量未写入
```

### worker.ts handleDocumentParse（re-parse 路径）

```ts
// 6. Mark source ready                              ← 先标 ready (worker.ts:191)
db().update(sources).set({ status: 'ready' }).run();
// 7. Re-embed under semaphore                       ← 后 embed (worker.ts:198)
const strategy = new EmbedStrategy();
await strategy.indexSource(sourceId, notebookId);
```

两处都违反 r2 "ready implies retrievable"。

## 修复方案

### pipeline.ts

```ts
try {
  // 2. Parse
  const result = await parser!.parse(input.buffer, input.filename);
  // 3. Chunk
  const chunked = chunkText(result.text);
  // 4. Insert chunk rows
  for (const c of chunked) { db().insert(chunks).values({...}).run(); }

  // 5. Embed SYNCHRONOUSLY (was fire-and-forget) — before marking ready
  const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
  const strategy = new EmbedStrategy();
  await strategy.indexSource(sourceRow.id, sourceRow.notebookId);

  // 6. Mark ready (only after vectors are written)
  db().update(sources).set({ status: 'ready', metadata: result.metadata ?? null })
    .where(eq(sources.id, sourceRow.id)).run();

  return { sourceId, chunkCount: chunked.length, status: 'ready', ... };
} catch (error) {
  // parse OR embed failure → failed (existing pattern, extended to cover embed)
  db().update(sources).set({ status: 'failed', errorCode: 'INGEST_ERROR', ... }).run();
  return { ..., status: 'failed' };
}
```

删除 `triggerEmbedding` helper（lines 29-34）——不再需要。

### worker.ts handleDocumentParse

交换 step 6/7：

```ts
// 6. Re-embed (BEFORE marking ready)
const releaseEmbed = await limiters.embedding.acquire();
try {
  const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
  const { deleteSourceVectors } = await import('../../db/vectors.ts');
  deleteSourceVectors(db(), sourceId);
  const strategy = new EmbedStrategy();
  await strategy.indexSource(sourceId, sourceRow.notebookId);
} finally { releaseEmbed(); }

// 7. Mark ready (after vectors written)
db().update(sources).set({ status: 'ready', metadata: ... }).where(eq(sources.id, sourceId)).run();
```

## 不做

- 不加 'indexing' 中间状态（v1 没有，加它需要 schema 迁移 + UI + 检索 status gate——超范围）
- 不改检索加 status gate（v2 searchVectors 不 join sources；本 change 通过保证 ready 时向量已写入来避免竞态，而非靠检索过滤）
- 不改 document_parse 为非阻塞（它已在 worker 内异步执行，本 change 只修正其内部顺序）

## 验证

- 更新 `test/sources/ingest.test.ts`：stubEmbedding 改为同步 stub（保留 noop），但断言 ingest 返回后 `vec_chunks` 有向量（或至少 indexSource 被调用且 ready 在其后）
- 新增竞态测试：ingest 完成后立即检查 source.status='ready' 且向量存在（通过 EmbedStrategy stub 确认调用顺序）
