import { Database } from 'bun:sqlite';
// Integration test: schema migration + sqlite-vec virtual table + vector CRUD.
//
// Uses a temp DB file under data/ so it never touches the real crystalith.db.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

import { createDb, resetDb, type Orm } from '../src/db/index.ts';
import { chunks, notebooks, sources } from '../src/db/schema.ts';
import {
  countVectors,
  deleteChunkVector,
  initVecChunks,
  insertChunkVector,
  searchVectors,
} from '../src/db/vectors.ts';
import { KeywordStrategy } from '../src/rag/keyword-strategy.ts';
import { seedChatModel } from './helpers/integration.ts';

const TMP_DB = 'data/test-vector.db';

// The real drizzle migrations folder (same one createDb() resolves in dev).
const DRIZZLE_DIR = join(import.meta.dirname, '..', 'drizzle');
const LEGACY_DB = 'data/test-legacy-migration.db';
const LEGACY_MIGRATIONS = 'data/test-legacy-drizzle';

let orm: Orm;

beforeAll(async () => {
  // Hermetic config (chat seeded; embedding dims fall back to 1024) — this
  // file drives createDb directly, bypassing setupIntegrationEnv's auto-seed,
  // and must not inherit the real app.yaml's dims when run from repo root.
  seedChatModel();
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) rmSync(f, { force: true });
  orm = createDb(TMP_DB);
  // KeywordStrategy goes through the client() singleton — point it at this
  // file's temp DB so the FTS regression below never touches a real DB.
  resetDb(orm);
});

afterAll(async () => {
  resetDb(null);
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) rmSync(f, { force: true });
});

describe('db: schema migration', () => {
  it('creates all relational tables incl. strategy_configs + vec_chunks', async () => {
    const rows = orm.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );
    const names = rows.map((r) => r.name);
    for (const expected of ['notebooks', 'chunks', 'strategy_configs', 'vec_chunks']) {
      expect(names).toContain(expected);
    }
    // 16 relational tables + vec_chunks + __drizzle_migrations
    expect(names.length).toBeGreaterThanOrEqual(18);
  });
});

describe('db: sqlite-vec virtual table', () => {
  it('inserts a notebook → source → chunk → vector and runs KNN search', async () => {
    const [nb] = orm.insert(notebooks).values({ name: 'Test Notebook' }).returning().all();
    const notebookId = nb.id;

    const [src] = orm
      .insert(sources)
      .values({
        notebookId,
        filename: 'test.txt',
        parserType: 'text',
        status: 'ready',
      })
      .returning()
      .all();
    const sourceId = src.id;

    const [chk] = orm
      .insert(chunks)
      .values({
        sourceId,
        chunkIndex: 0,
        text: 'Crystalith is a RAG-powered knowledge notebook.',
      })
      .returning()
      .all();
    const chunkId = chk.id;

    // 1024-dim vector (default embedding dimension): one-hot at index 0.
    const vec = new Float32Array(1024);
    vec[0] = 1.0;
    await insertChunkVector(orm, chunkId, notebookId, sourceId, vec);

    expect(await countVectors(orm, notebookId)).toBe(1);

    // Second chunk with a different (orthogonal-ish) vector.
    const [chk2] = orm
      .insert(chunks)
      .values({
        sourceId,
        chunkIndex: 1,
        text: 'Another chunk about embeddings.',
      })
      .returning()
      .all();
    const vec2 = new Float32Array(1024);
    vec2[1] = 1.0;
    await insertChunkVector(orm, chk2.id, notebookId, sourceId, vec2);

    // KNN: query vector close to `vec` → chunkId should rank first.
    const query = new Float32Array(1024);
    query[0] = 1.0;
    const hits = await searchVectors(orm, query, notebookId, 2);
    expect(hits).toHaveLength(2);
    expect(hits[0].rowid).toBe(chunkId);
    expect(hits[0].text).toContain('Crystalith');
    expect(hits[0].distance).toBeLessThan(hits[1].distance);

    // Cleanup: delete vector then verify the chunk row survives.
    await deleteChunkVector(orm, chunkId);
    expect(await countVectors(orm, notebookId)).toBe(1);

    const [row] = orm.select().from(chunks).where(eq(chunks.id, chunkId)).all();
    expect(row).toBeDefined();
    expect(row.text).toContain('Crystalith');
  });

  it('sourceIds filter finds a small source even when others dominate KNN', async () => {
    // Populate many vectors for source A so notebook-wide top-K would miss source B
    // under the old over-fetch+post-filter approach.
    const [nb] = orm.insert(notebooks).values({ name: 'Filter NB' }).returning().all();
    const notebookId = nb.id;
    const [srcA] = orm
      .insert(sources)
      .values({ notebookId, filename: 'big.txt', status: 'ready' })
      .returning()
      .all();
    const [srcB] = orm
      .insert(sources)
      .values({ notebookId, filename: 'small.txt', status: 'ready' })
      .returning()
      .all();

    for (let i = 0; i < 20; i++) {
      const [chk] = orm
        .insert(chunks)
        .values({ sourceId: srcA.id, chunkIndex: i, text: `big chunk ${i}` })
        .returning()
        .all();
      const vec = new Float32Array(1024);
      vec[0] = 1.0;
      await insertChunkVector(orm, chk.id, notebookId, srcA.id, vec);
    }

    const [smallChk] = orm
      .insert(chunks)
      .values({ sourceId: srcB.id, chunkIndex: 0, text: 'needle in small source' })
      .returning()
      .all();
    const smallVec = new Float32Array(1024);
    smallVec[1] = 1.0; // orthogonal to source A → ranks last notebook-wide
    await insertChunkVector(orm, smallChk.id, notebookId, srcB.id, smallVec);

    const query = new Float32Array(1024);
    query[0] = 1.0; // closer to source A

    // Notebook-wide: source B should not appear in tiny top-K
    const unscoped = await searchVectors(orm, query, notebookId, 5);
    expect(unscoped.every((h) => h.source_id === srcA.id)).toBe(true);

    // Scoped to B: must still return the needle via partition equality
    const scoped = await searchVectors(orm, query, notebookId, 5, [srcB.id]);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].rowid).toBe(smallChk.id);
    expect(scoped[0].text).toContain('needle');
  });

  it('ranks by cosine, not L2 — normalized-vector regression', async () => {
    // B points in the query direction but is LONGER ([1.5, 0, …]); C is a
    // shorter 0.9-cosine neighbor. L2 ranks C first (0.447 < 0.5) while
    // cosine ranks B first (0 < 0.1) — guards the distance_metric=cosine
    // declaration (default L2 mis-converts to `score = 1 - distance` and
    // pushed real bge-m3 hits below the evidence threshold).
    const [nb] = orm.insert(notebooks).values({ name: 'Cosine NB' }).returning().all();
    const notebookId = nb.id;
    const [src] = orm
      .insert(sources)
      .values({ notebookId, filename: 'cos.txt', status: 'ready' })
      .returning()
      .all();

    const mk = (dims: [number, number]) => {
      const v = new Float32Array(1024);
      v[0] = dims[0];
      v[1] = dims[1];
      return v;
    };

    let nextChunkIndex = 0;
    const insert = async (text: string, vec: Float32Array) => {
      const [chk] = orm
        .insert(chunks)
        .values({ sourceId: src.id, chunkIndex: nextChunkIndex++, text })
        .returning()
        .all();
      await insertChunkVector(orm, chk.id, notebookId, src.id, vec);
      return chk.id;
    };
    const bId = await insert('same direction, longer', mk([1.5, 0]));
    const cId = await insert('0.9 cosine neighbor', mk([0.9, Math.sqrt(1 - 0.81)]));

    const hits = await searchVectors(orm, mk([1, 0]), notebookId, 2);
    expect(hits.map((h) => h.rowid)).toEqual([bId, cId]);
    // cosine distance ≈ 1 − cos similarity
    expect(hits[0].distance).toBeCloseTo(0, 3);
    expect(hits[1].distance).toBeCloseTo(0.1, 3);
  });

  it('initVecChunks rebuilds a legacy L2 table in place (cosine migration)', async () => {
    // Simulate a pre-cosine DB: create the old declaration, insert a vector,
    // then run initVecChunks — the table must come back with cosine semantics
    // and all rows preserved (no re-embed required).
    orm.run(sql`DROP TABLE vec_chunks`);
    orm.run(
      sql.raw(`CREATE VIRTUAL TABLE vec_chunks USING vec0(
        embedding float[1024],
        notebook_id integer partition by,
        source_id integer partition by
      );`),
    );
    const [nb] = orm.insert(notebooks).values({ name: 'Legacy NB' }).returning().all();
    const notebookId = nb.id;
    const [src] = orm
      .insert(sources)
      .values({ notebookId, filename: 'legacy.txt', status: 'ready' })
      .returning()
      .all();
    const [chk] = orm
      .insert(chunks)
      .values({ sourceId: src.id, chunkIndex: 0, text: 'legacy vector' })
      .returning()
      .all();
    const v0 = new Float32Array(1024);
    v0[0] = 1;
    await insertChunkVector(orm, chk.id, notebookId, src.id, v0);

    initVecChunks(orm);

    const ddl = orm.all<{ sql: string }>(
      sql`SELECT sql FROM sqlite_master WHERE name='vec_chunks'`,
    )[0].sql;
    expect(ddl).toContain('distance_metric=cosine');
    expect(await countVectors(orm, notebookId)).toBe(1);

    // Identical query vector → cosine distance ≈ 0 (L2 would also give 0, so
    // also assert the orthogonal case: distance must be exactly 1, not √1).
    const ortho = new Float32Array(1024);
    ortho[1] = 1;
    const [hit] = await searchVectors(orm, ortho, notebookId, 1);
    expect(hit.distance).toBeCloseTo(1, 5);
  });
});

describe('db: chunks embedding metadata columns (c130 r479)', () => {
  it('migration adds the 5 columns with correct defaults (PRAGMA table_info)', () => {
    const cols = orm.all<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
    }>(sql`PRAGMA table_info(chunks)`);
    const byName = new Map(cols.map((c) => [c.name, c]));
    const expectColumn = (name: string, type: string, notnull: number, dflt: string | null) => {
      const col = byName.get(name);
      expect(col).toBeDefined();
      expect(col?.type.toLowerCase()).toBe(type);
      expect(col?.notnull).toBe(notnull);
      expect(col?.dflt_value).toBe(dflt);
    };

    expectColumn('modality', 'text', 1, "'text'");
    expectColumn('embedding_model', 'text', 0, null);
    expectColumn('embedding_dims', 'integer', 0, null);
    expectColumn('origin_type', 'text', 1, "'source'");
    expectColumn('origin_id', 'integer', 0, null);
  });

  it('rows inserted without the new columns get defaults; origin_id stays NULL (no backfill for new rows)', () => {
    const [nb] = orm.insert(notebooks).values({ name: 'Meta Defaults NB' }).returning().all();
    const [src] = orm
      .insert(sources)
      .values({ notebookId: nb.id, filename: 'meta.txt', status: 'ready' })
      .returning()
      .all();
    const [chk] = orm
      .insert(chunks)
      .values({ sourceId: src.id, chunkIndex: 0, text: 'meta defaults check' })
      .returning()
      .all();

    expect(chk.modality).toBe('text');
    expect(chk.originType).toBe('source');
    expect(chk.embeddingModel).toBeNull();
    expect(chk.embeddingDims).toBeNull();
    // New rows are NOT backfilled — only pre-migration rows get origin_id.
    expect(chk.originId).toBeNull();
  });

  it('0008 backfills origin_id=source_id for pre-migration rows (legacy DB through the boot migrator)', () => {
    // Build a migrations folder frozen at the pre-0008 state (journal entries
    // 0–7 only; the migrator skips entries whose journal `when` is <= the last
    // applied created_at, so 0000–0007 apply here and 0008 stays pending).
    rmSync(LEGACY_MIGRATIONS, { recursive: true, force: true });
    mkdirSync(join(LEGACY_MIGRATIONS, 'meta'), { recursive: true });
    const journal = JSON.parse(
      readFileSync(join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf8'),
    ) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const legacyEntries = journal.entries.filter((e) => e.idx <= 7);
    writeFileSync(
      join(LEGACY_MIGRATIONS, 'meta', '_journal.json'),
      JSON.stringify({ ...journal, entries: legacyEntries }, null, 2),
    );
    for (const entry of legacyEntries) {
      copyFileSync(
        join(DRIZZLE_DIR, `${entry.tag}.sql`),
        join(LEGACY_MIGRATIONS, `${entry.tag}.sql`),
      );
    }

    for (const f of [LEGACY_DB, `${LEGACY_DB}-wal`, `${LEGACY_DB}-shm`]) rmSync(f, { force: true });
    const raw = new Database(LEGACY_DB, { create: true });
    const legacyOrm = drizzle({ client: raw });
    try {
      // Pre-0008 database: schema applied, legacy chunks already on disk.
      migrate(legacyOrm, { migrationsFolder: LEGACY_MIGRATIONS });
      legacyOrm.run(
        sql`INSERT INTO notebooks (name, created_at, updated_at) VALUES ('legacy-nb', 0, 0)`,
      );
      legacyOrm.run(
        sql`INSERT INTO sources (notebook_id, filename, status, created_at, updated_at)
            VALUES (1, 'legacy.txt', 'ready', 0, 0)`,
      );
      legacyOrm.run(
        sql`INSERT INTO chunks (source_id, chunk_index, text, created_at, updated_at) VALUES
            (1, 0, 'legacy chunk zero', 0, 0),
            (1, 1, 'legacy chunk one', 0, 0)`,
      );

      // Boot path: same migrator + real migrations folder as createDb() —
      // applies only the pending 0008 entry.
      migrate(legacyOrm, { migrationsFolder: DRIZZLE_DIR });

      const rows = legacyOrm.all<{
        id: number;
        source_id: number;
        modality: string;
        embedding_model: string | null;
        embedding_dims: number | null;
        origin_type: string;
        origin_id: number | null;
      }>(sql`SELECT id, source_id, modality, embedding_model, embedding_dims, origin_type, origin_id
             FROM chunks ORDER BY id`);
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.modality).toBe('text');
        expect(row.origin_type).toBe('source');
        expect(row.embedding_model).toBeNull();
        expect(row.embedding_dims).toBeNull();
        // The backfill: pre-migration rows point at their own source.
        expect(row.origin_id).toBe(row.source_id);
      }
    } finally {
      raw.close();
      rmSync(LEGACY_MIGRATIONS, { recursive: true, force: true });
      for (const f of [LEGACY_DB, `${LEGACY_DB}-wal`, `${LEGACY_DB}-shm`])
        rmSync(f, { force: true });
    }
  });

  it('FTS5 content-sync triggers still mirror chunks inserts (keyword path regression)', async () => {
    // KeywordStrategy.indexSource runs the real ensureFts() (chunks_fts +
    // content-sync triggers). retrieve()'s regression (incl. the fixed
    // source_id/chunk_index columns) lives in tests/rag/vector-dim-guard.test.ts;
    // this case only checks the AFTER INSERT trigger sync via a direct FTS query.
    const [nb] = orm.insert(notebooks).values({ name: 'FTS NB' }).returning().all();
    const [src] = orm
      .insert(sources)
      .values({ notebookId: nb.id, filename: 'fts.txt', status: 'ready' })
      .returning()
      .all();

    const strategy = new KeywordStrategy();
    // ensureFts() must run before the insert so the AFTER INSERT trigger fires.
    await strategy.indexSource(src.id, nb.id);

    const [chk] = orm
      .insert(chunks)
      .values({ sourceId: src.id, chunkIndex: 0, text: 'zirconium lantern quay orchestrion' })
      .returning()
      .all();

    const hits = orm.all<{ rowid: number }>(
      sql`SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH 'zirconium'`,
    );
    expect(hits.map((h) => h.rowid)).toContain(chk.id);
  });
});
