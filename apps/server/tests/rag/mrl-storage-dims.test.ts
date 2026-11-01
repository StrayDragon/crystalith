// covers: r494（embedding-mrl-truncation）——生效维度贯通 DB 层：vec_chunks 建表按
// 截断口径（非模型声明维度）；截断后的向量可入库、可 KNN 检索；旧宽表在开启截断后
// 判 dim_mismatch（期望=截断目标/现表=声明宽度）且 global 重建收敛到新宽度。
//
// c133 r494 — effective-dims DB integration lock. The engine-level truncation
// behavior is unit-locked in mrl-truncation.test.ts (pure mock, no DB); this
// file locks the storage half: boot-time table width, insert/search through
// the real vec0 table, and the dim_mismatch → global rebuild convergence path.
//
// Hermetic per-file setup: 'ai' mocked to return DECLARED-width vectors that
// ignore the `dimensions` param (gateway-ignores-param posture → engine local
// slice path), config seeded BEFORE setupIntegrationEnv so boot builds the
// table at the effective (truncated) width.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { eq } from 'drizzle-orm';

const DECLARED_DIMS = 6;
const TARGET_DIMS = 4;
const DB2_PATH = join(import.meta.dirname, '..', '..', 'data', `test-mrl-dims-2-${process.pid}.db`);

// Gateway posture: always returns DECLARED-width vectors (ignores `dimensions`).
const mockVector = () => Array.from({ length: DECLARED_DIMS }, (_, i) => (i + 1) / DECLARED_DIMS);

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked' }),
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  embed: async () => ({ embedding: mockVector() }),
  embedMany: async ({ values }: { values: string[] }) => ({
    embeddings: values.map(() => mockVector()),
  }),
  tool: (def: unknown) => def,
}));

import { client, createDb, db, resetDb, type Orm } from '../../src/db/index.ts';
import { chunks, indexJobs, notebooks, sources } from '../../src/db/schema.ts';
import { countVectors, readVecTableDim, searchVectors } from '../../src/db/vectors.ts';
import { EmbedStrategy } from '../../src/rag/embed-strategy.ts';
import { embedSingle, resetEmbedderForTests } from '../../src/rag/embedder.ts';
import { getIndexState, startIndexRebuild } from '../../src/rag/index-rebuild.ts';
import { resetConfig, type AppConfig } from '../../src/shared/config.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

function seedModel(truncation?: number): void {
  const cfg: AppConfig = {
    models: {
      defaults: { chat: 'test-chat', embedding: 'test-embed' },
      available: [
        {
          id: 'test-chat',
          provider: 'openai',
          model: 'gpt-test',
          displayName: 'Test Chat',
          roles: ['chat'],
          capabilities: [],
          providerConfig: { apiKey: 'test-key' },
        },
        {
          id: 'test-embed',
          provider: 'openai',
          model: 'bge-m3-test',
          displayName: 'Test Embed',
          roles: ['embed'],
          capabilities: [],
          embedding: {
            dims: DECLARED_DIMS,
            mrlDims: [TARGET_DIMS, DECLARED_DIMS],
            modalities: ['text'],
          },
          providerConfig: { apiKey: 'test-key' },
        },
      ],
    },
    raw: truncation ? { embedding: { truncation_dims: truncation } } : {},
  };
  resetConfig(cfg);
  resetEmbedderForTests();
}

function seedNotebookWithChunk(orm: Orm, name: string): number {
  const nb = orm.insert(notebooks).values({ name }).returning().get().id;
  const src = orm
    .insert(sources)
    .values({ notebookId: nb, filename: `${name}.md`, status: 'ready' })
    .returning()
    .get().id;
  orm
    .insert(chunks)
    .values({ sourceId: src, chunkIndex: 0, text: `${name} 内容` })
    .run();
  return nb;
}

function firstSourceId(orm: Orm, nb: number): number {
  return orm.select({ id: sources.id }).from(sources).where(eq(sources.notebookId, nb)).get()!.id;
}

async function waitFor(cond: () => Promise<boolean>, ms = 5000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('waitFor timeout');
}

let nb1: number;

beforeAll(() => {
  // Truncation ON before boot → vec_chunks must be created at TARGET width.
  seedModel(TARGET_DIMS);
  setupIntegrationEnv();
  nb1 = seedNotebookWithChunk(getOrm(), 'mrl-nb1');
});

afterAll(() => {
  teardownIntegrationEnv();
  for (const f of [DB2_PATH, `${DB2_PATH}-wal`, `${DB2_PATH}-shm`]) rmSync(f, { force: true });
  resetConfig();
});

describe('r494 effective dims reach the storage layer', () => {
  it('boots vec_chunks at the truncated width and indexes/searches truncated vectors', async () => {
    expect(await readVecTableDim(db())).toBe(TARGET_DIMS);

    await new EmbedStrategy().indexSource(firstSourceId(getOrm(), nb1), nb1);
    expect(await countVectors(db(), nb1)).toBe(1);

    // Engine slices the 6-dim mock vector to 4 → insert + KNN both fit the table.
    const queryVec = await embedSingle('检索词');
    expect(queryVec.length).toBe(TARGET_DIMS);
    const hits = await searchVectors(db(), queryVec, nb1, 5);
    expect(hits.length).toBe(1);
    expect(hits[0]!.text).toBe('mrl-nb1 内容');

    expect((await getIndexState(nb1)).state).toBe('ready');
  });
});

describe('r494 legacy wide table converges through global rebuild', () => {
  it('reports dim_mismatch (expected=target/table=declared) and rebuild lands at target width', async () => {
    // DB #1 (integration env) is truncation-on; build a second DB WITHOUT
    // truncation → table at declared width, vectors indexed at declared width.
    // EmbedStrategy (and the rebuild path) run against the db() singleton, so
    // point it at orm2 before seeding/indexing.
    seedModel();
    const orm2 = createDb(DB2_PATH);
    resetDb(orm2);
    const nb2 = seedNotebookWithChunk(orm2, 'mrl-nb2');
    expect(await readVecTableDim(orm2)).toBe(DECLARED_DIMS);
    await new EmbedStrategy().indexSource(firstSourceId(orm2, nb2), nb2);
    expect(await countVectors(orm2, nb2)).toBe(1);

    // Flip truncation on post-hoc (config change without rebuild) → the
    // expected width (target) no longer matches the table (declared).
    seedModel(TARGET_DIMS);
    resetDb(orm2);

    const mismatch = await getIndexState(nb2);
    expect(mismatch.state).toBe('dim_mismatch');
    expect(mismatch.declaredDims).toBe(TARGET_DIMS);
    expect(mismatch.tableDims).toBe(DECLARED_DIMS);

    // Rebuild must pick global mode, recreate the table at TARGET width, and
    // re-embed truncated vectors into it — the previously-unreachable path.
    const { jobId, mode } = await startIndexRebuild(nb2);
    expect(mode).toBe('global');
    await waitFor(async () => {
      const row = await client().get(db().select().from(indexJobs).where(eq(indexJobs.id, jobId)));
      return row?.state === 'succeeded' || row?.state === 'failed';
    });

    expect(await readVecTableDim(orm2)).toBe(TARGET_DIMS);
    expect(await countVectors(orm2, nb2)).toBe(1);
    expect((await getIndexState(nb2)).state).toBe('ready');

    const hits = await searchVectors(orm2, await embedSingle('检索词'), nb2, 5);
    expect(hits.length).toBe(1);
    resetDb(null);
    orm2.$client.close();
  });
});
