// c132 r487 — keyword-channel CJK recall over chunks.text_tokens:
//   short (two-char) Chinese queries, longer phrases, latin no-regression,
//   legacy-row backfill, and legacy-shape (raw `text`) chunks_fts migration.
// Hermetic: temp DB via createDb (boot ensureFtsIndex runs there); retrieval
// via ftsSearch / KeywordStrategy — no embedding involved.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { rmSync } from 'node:fs';

import { sql } from 'drizzle-orm';

import { insertChunk } from '../../src/db/chunks.ts';
import { ensureFtsIndex, ftsSearch } from '../../src/db/fts.ts';
import { createDb, resetDb, type Orm } from '../../src/db/index.ts';
import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { KeywordStrategy } from '../../src/rag/keyword-strategy.ts';

const TMP_DB = 'data/test-fts-cjk-recall.db';

let orm: Orm;
let nbId: number;

beforeAll(async () => {
  orm = createDb(TMP_DB);
  resetDb(orm);

  const [nb] = orm.insert(notebooks).values({ name: 'cjk-recall' }).returning().all();
  nbId = nb.id;
  const [src] = orm
    .insert(sources)
    .values({ notebookId: nbId, filename: '向量笔记.md', status: 'ready' })
    .returning()
    .all();

  // Insert through the production seam so text_tokens is populated.
  await insertChunk({
    sourceId: src.id,
    chunkIndex: 0,
    text: '向量数据库支持余弦相似度检索， EmbeddingGemma 提供默认前缀。',
  });
  await insertChunk({
    sourceId: src.id,
    chunkIndex: 1,
    text: '大语言模型的应用场景十分广泛。',
  });
});

afterAll(() => {
  resetDb(null);
  rmSync(TMP_DB, { force: true });
});

describe('r487 CJK keyword recall over text_tokens', () => {
  it('a two-char Chinese query hits the containing chunk (bm25-ranked)', async () => {
    const hits = await ftsSearch(orm, '向量', { notebookId: nbId, topK: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunkId).toBeDefined();
    expect(hits[0].text).toContain('向量数据库');
  });

  it('a longer Chinese phrase still hits via OR-joined bigrams', async () => {
    const hits = await ftsSearch(orm, '余弦相似度', { notebookId: nbId, topK: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].text).toContain('余弦相似度');
  });

  it('latin queries keep matching (no regression)', async () => {
    const hits = await ftsSearch(orm, 'embeddinggemma', { notebookId: nbId, topK: 5 });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('KeywordStrategy.retrieve returns the same hits (strategy wiring)', async () => {
    const strategy = new KeywordStrategy();
    const results = await strategy.retrieve('向量', nbId);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
  });
});

describe('r487 legacy migration paths (boot ensureFtsIndex)', () => {
  it('backfills NULL text_tokens rows and rebuilds so they become searchable', async () => {
    const [src] = orm
      .insert(sources)
      .values({ notebookId: nbId, filename: 'legacy.md', status: 'ready' })
      .returning()
      .all();
    // Pre-0010 row: direct insert, no token column value.
    const [legacy] = orm
      .insert(chunks)
      .values({ sourceId: src.id, chunkIndex: 0, text: '历史遗留的中文块内容' })
      .returning()
      .all();

    ensureFtsIndex(orm);

    const stored = orm.all<{ text_tokens: string | null }>(
      sql`SELECT text_tokens FROM chunks WHERE id = ${legacy.id}`,
    )[0];
    expect(stored?.text_tokens).toContain('历史');
    const hits = await ftsSearch(orm, '遗留', { notebookId: nbId, topK: 10 });
    expect(hits.some((h) => h.chunkId === legacy.id)).toBe(true);
  });

  it('migrates a legacy chunks_fts (indexed raw text) to the token shape', async () => {
    // Recreate the legacy shape by hand.
    orm.run(sql.raw(`DROP TABLE IF EXISTS chunks_fts`));
    orm.run(
      sql.raw(
        `CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content='chunks', content_rowid='id')`,
      ),
    );

    ensureFtsIndex(orm);

    const ddl = orm.all<{ sql: string }>(
      sql`SELECT sql FROM sqlite_master WHERE type='table' AND name='chunks_fts'`,
    )[0].sql;
    expect(ddl).toContain('text_tokens');
    // All rows (incl. the backfilled legacy chunk above) are searchable again.
    const hits = await ftsSearch(orm, '向量', { notebookId: nbId, topK: 10 });
    expect(hits.length).toBeGreaterThan(0);
  });
});
