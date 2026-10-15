// c131 r480/r481 — async index rebuild: notebook/global modes, reentry guard,
// restart recovery, epoch bump, status surface (service + router wire).
//
// Hermetic per-file setup: 'ai' mocked with MOCK_DIMS-wide vectors behind a
// controllable gate (reentry/rebuilding assertions); config seeded BEFORE
// setupIntegrationEnv so vec_chunks is created at the declared dims.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { eq, sql } from 'drizzle-orm';

const SEED_DIMS = 6;
const NEW_DIMS = 5;
let MOCK_DIMS = SEED_DIMS;
let gate: Promise<void> | null = null;
let embedCalls = 0;

const mockVector = () => Array.from({ length: MOCK_DIMS }, (_, i) => (i + 1) / MOCK_DIMS);

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
  embedMany: async ({ values }: { values: string[] }) => {
    if (gate) await gate;
    embedCalls++;
    return { embeddings: values.map(() => mockVector()) };
  },
  tool: (def: unknown) => def,
}));

import { db } from '../../src/db/index.ts';
import { chunks, indexJobs, notebooks, sources, studioSlides } from '../../src/db/schema.ts';
import { countVectors, readVecTableDim } from '../../src/db/vectors.ts';
import { sourceExtrasRouter } from '../../src/features/sources/source-extras.router.ts';
import { vectorEpochOf } from '../../src/rag/cache.ts';
import { EmbedStrategy } from '../../src/rag/embed-strategy.ts';
import { resetEmbedderForTests } from '../../src/rag/embedder.ts';
import {
  getIndexState,
  recoverInterruptedJobs,
  startIndexRebuild,
} from '../../src/rag/index-rebuild.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

let nb1: number;
let nb2: number;
let src11: number;
let src21: number;

function seedModel(dims: number) {
  resetConfig({
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
          embedding: { dims, modalities: ['text'] },
          providerConfig: { apiKey: 'test-key' },
        },
      ],
    },
    raw: {},
  });
}

async function waitFor(cond: () => Promise<boolean>, ms = 5000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('waitFor timeout');
}

async function jobDone(jobId: number): Promise<void> {
  await waitFor(async () => {
    const row = await (
      await import('../../src/db/index.ts')
    )
      .client()
      .get(db().select().from(indexJobs).where(eq(indexJobs.id, jobId)));
    return row?.state === 'succeeded' || row?.state === 'failed';
  });
}

beforeAll(() => {
  seedModel(SEED_DIMS);
  setupIntegrationEnv();
  const orm = getOrm();
  nb1 = orm.insert(notebooks).values({ name: 'rebuild-nb1' }).returning().get().id;
  nb2 = orm.insert(notebooks).values({ name: 'rebuild-nb2' }).returning().get().id;
  src11 = orm
    .insert(sources)
    .values({ notebookId: nb1, filename: 'nb1.md', status: 'ready' })
    .returning()
    .get().id;
  src21 = orm
    .insert(sources)
    .values({ notebookId: nb2, filename: 'nb2.md', status: 'ready' })
    .returning()
    .get().id;
  orm.insert(chunks).values({ sourceId: src11, chunkIndex: 0, text: '一号本内容' }).run();
  orm.insert(chunks).values({ sourceId: src21, chunkIndex: 0, text: '二号本内容' }).run();
});

afterAll(() => {
  teardownIntegrationEnv();
  resetConfig();
});

describe('r480 notebook-mode rebuild', () => {
  it('re-embeds only the requesting notebook and bumps its vector epoch', async () => {
    const strategy = new EmbedStrategy();
    await strategy.indexSource(src11, nb1);
    await strategy.indexSource(src21, nb2);
    const epochBefore1 = vectorEpochOf(nb1);
    const epochBefore2 = vectorEpochOf(nb2);
    const nb2CountBefore = await countVectors(db(), nb2);

    const { jobId, mode } = await startIndexRebuild(nb1);
    expect(mode).toBe('notebook');
    await jobDone(jobId);

    expect(await countVectors(db(), nb1)).toBe(1);
    expect(await countVectors(db(), nb2)).toBe(nb2CountBefore);
    expect(vectorEpochOf(nb1)).toBeGreaterThan(epochBefore1);
    expect(vectorEpochOf(nb2)).toBe(epochBefore2);

    const job = await (
      await import('../../src/db/index.ts')
    )
      .client()
      .get(db().select().from(indexJobs).where(eq(indexJobs.id, jobId)));
    expect(job?.state).toBe('succeeded');
    expect(job?.total).toBe(1);
    expect(job?.done).toBe(1);
    expect(job?.failed).toBe(0);
  });

  it('rejects a second start with 409 while a job is running', async () => {
    let release!: () => void;
    gate = new Promise<void>((r) => {
      release = r;
    });
    const { jobId } = await startIndexRebuild(nb1);
    let second: unknown;
    try {
      try {
        await startIndexRebuild(nb1);
      } catch (error) {
        second = error;
      }
    } finally {
      release(); // always unblock — a wedged job would poison later tests
    }
    expect((second as { code?: string }).code).toBe('CONFLICT');
    await jobDone(jobId);
  });
});

describe('r480 global-mode rebuild (dim change)', () => {
  it('recreates the table at the declared dims and re-embeds every notebook', async () => {
    MOCK_DIMS = NEW_DIMS;
    seedModel(NEW_DIMS); // table stays at SEED_DIMS → mismatch → global mode
    resetEmbedderForTests(); // fresh process semantics for the new dims

    const { jobId, mode } = await startIndexRebuild(nb2);
    expect(mode).toBe('global');
    await jobDone(jobId);

    const job = await (
      await import('../../src/db/index.ts')
    )
      .client()
      .get(db().select().from(indexJobs).where(eq(indexJobs.id, jobId)));
    expect(job?.state).toBe('succeeded');
    expect(job?.error).toBeNull();
    expect(job?.total).toBe(2);
    expect(job?.done).toBe(2);

    expect(await readVecTableDim(db())).toBe(NEW_DIMS);
    expect(await countVectors(db(), nb1)).toBe(1);
    expect(await countVectors(db(), nb2)).toBe(1);
  });
});

describe('r481 status surface', () => {
  it('reports dim_mismatch with both dims; interrupted surfaces once dims agree again', async () => {
    MOCK_DIMS = SEED_DIMS;
    seedModel(SEED_DIMS); // table is NEW_DIMS now → mismatch
    resetEmbedderForTests();

    let status = await getIndexState(nb1);
    expect(status.state).toBe('dim_mismatch');
    expect(status.declaredDims).toBe(SEED_DIMS);
    expect(status.tableDims).toBe(NEW_DIMS);

    // Bring table back in line so the interrupted marker is observable
    // (state precedence: rebuilding > dim_mismatch > interrupted).
    const { jobId } = await startIndexRebuild(nb1);
    await jobDone(jobId);
    status = await getIndexState(nb1);
    expect(status.state).toBe('ready');

    // Simulate a crashed job: a running row without a live worker.
    await (
      await import('../../src/db/index.ts')
    )
      .client()
      .run(db().insert(indexJobs).values({ notebookId: nb1, mode: 'notebook', state: 'running' }));
    await recoverInterruptedJobs();
    status = await getIndexState(nb1);
    expect(status.state).toBe('interrupted');
  });

  it('prunes job history to the newest per notebook (suggestion)', async () => {
    const c = (await import('../../src/db/index.ts')).client();
    const orm = getOrm();
    for (let i = 0; i < 3; i++) {
      await c.run(
        db()
          .insert(indexJobs)
          .values({ notebookId: nb1, mode: 'notebook', state: 'succeeded', done: 1, total: 1 }),
      );
    }
    await c.run(
      db().insert(indexJobs).values({ notebookId: nb2, mode: 'notebook', state: 'failed' }),
    );
    const before = orm
      .select({ c: sql<number>`count(*)` })
      .from(indexJobs)
      .all()[0].c;

    const { jobId } = await startIndexRebuild(nb1);
    await jobDone(jobId);

    const rows = orm.select().from(indexJobs).all();
    expect(rows.length).toBeLessThan(before + 1); // history did NOT accumulate
    const nb1Jobs = rows.filter((r) => r.notebookId === nb1);
    expect(nb1Jobs).toHaveLength(1); // only the newest (this rebuild) survives
    expect(nb1Jobs[0].id).toBe(jobId);
    expect(rows.filter((r) => r.notebookId === nb2)).toHaveLength(1);
  });

  it('router exposes rebuild (202) and status (rebuilding → ready)', async () => {
    const { searchIndexRouter } = await import('../../src/features/sources/search-index.router.ts');
    const BASE = 'http://local/v2';

    MOCK_DIMS = NEW_DIMS;
    seedModel(NEW_DIMS); // table is SEED_DIMS → mismatch → global job covers nb2
    resetEmbedderForTests();

    let release!: () => void;
    gate = new Promise<void>((r) => {
      release = r;
    });
    try {
      const started = await searchIndexRouter.handle(
        new Request(`${BASE}/notebooks/${nb1}/search-index/rebuild`, { method: 'POST' }),
      );
      expect(started.status).toBe(202);
      const body = (await started.json()) as { jobId: number; mode: string };
      expect(body.mode).toBe('global'); // table NEW_DIMS vs declared SEED_DIMS

      const during = await searchIndexRouter.handle(
        new Request(`${BASE}/notebooks/${nb2}/search-index`),
      );
      expect(during.status).toBe(200);
      const duringBody = (await during.json()) as { state: string; progress?: unknown };
      expect(duringBody.state).toBe('rebuilding'); // global job covers nb2 too
      expect(duringBody.progress).toBeDefined();

      release();
      await jobDone(body.jobId);

      const after = await searchIndexRouter.handle(
        new Request(`${BASE}/notebooks/${nb1}/search-index`),
      );
      const afterBody = (await after.json()) as { state: string; lastJob?: { state: string } };
      expect(afterBody.state).toBe('ready');
      expect(afterBody.lastJob?.state).toBe('succeeded');
    } finally {
      gate = null;
    }
  });

  it('router 404s on a bogus notebook id (async scope guard is awaited)', async () => {
    // Regression guard: requireNotebook went async in c128 — without the
    // await the NotFoundError became an unhandled rejection and the bogus nid
    // sailed through the guard (into a potentially destructive global
    // rebuild when the vec table is dim-mismatched).
    const { createApp } = await import('../../src/server.ts');
    const app = createApp();
    const BASE = 'http://test.local';

    const rebuild = await app.handle(
      new Request(`${BASE}/v2/notebooks/424242/search-index/rebuild`, { method: 'POST' }),
    );
    expect(rebuild.status).toBe(404);
    expect(((await rebuild.json()) as { errorCode: string }).errorCode).toBe('NOT_FOUND');

    const status = await app.handle(new Request(`${BASE}/v2/notebooks/424242/search-index`));
    expect(status.status).toBe(404);
  });

  it('a same-tick second start is rejected — the reentry guard is not check-then-act', async () => {
    // Regression guard: the slot must be reserved synchronously, before the
    // first await — otherwise two concurrent POSTs both pass the check and
    // run overlapping rebuild jobs.
    const p1 = startIndexRebuild(nb1);
    const p2 = startIndexRebuild(nb1);
    await expect(p2).rejects.toThrow('正在进行');
    const first = await p1;
    await jobDone(first.jobId);

    const rows = getOrm().select().from(indexJobs).where(eq(indexJobs.notebookId, nb1)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('succeeded');
  });
});

describe('r482 caller degradation during rebuild', () => {
  it('QA chat short-circuits with index_rebuilding and never embeds', async () => {
    const { retrieveAndJudge } = await import('../../src/features/qa/retrieve-and-judge.ts');
    let release!: () => void;
    gate = new Promise<void>((r) => {
      release = r;
    });
    const embedCallsBefore = embedCalls;
    const { jobId } = await startIndexRebuild(nb1);
    try {
      const judgment = await retrieveAndJudge({
        notebookId: nb1,
        question: '重建期间还能提问吗',
        sourceIds: [src11],
        topK: 5,
        minScore: 0.2,
        historyTokens: 0,
      });
      expect(judgment.evidence).toBe(false);
      expect(judgment.reason).toBe('index_rebuilding');
      expect(embedCalls).toBe(embedCallsBefore); // retrieval (and embedding) never ran
    } finally {
      release();
    }
    await jobDone(jobId);
  });

  it('outputs retrieval fails fast with INDEX_REBUILDING', async () => {
    const { resolvePipelineContextChunks } = await import('../../src/features/outputs/pipeline.ts');
    let release!: () => void;
    gate = new Promise<void>((r) => {
      release = r;
    });
    const { jobId } = await startIndexRebuild(nb1);
    let error: unknown;
    try {
      try {
        await resolvePipelineContextChunks({
          model: {} as never,
          notebookId: nb1,
          type: 'FAQ',
          prompt: 'guide question',
        });
      } catch (e) {
        error = e;
      }
    } finally {
      release();
    }
    expect((error as { code?: string }).code).toBe('INDEX_REBUILDING');
    await jobDone(jobId);
  });

  it('studio slides retrieval fails fast with INDEX_REBUILDING (W1)', async () => {
    const { getContext } = await import('../../src/features/studio/service.ts');
    const slide = getOrm()
      .insert(studioSlides)
      .values({
        notebookId: nb1,
        title: '重建中的幻灯片',
        prompt: '生成一页关于检索的幻灯片',
        sourceIds: [src11],
      })
      .returning()
      .get();
    let release!: () => void;
    gate = new Promise<void>((r) => {
      release = r;
    });
    const { jobId } = await startIndexRebuild(nb1);
    let error: unknown;
    try {
      try {
        await getContext(slide);
      } catch (e) {
        error = e;
      }
    } finally {
      release();
    }
    expect((error as { code?: string }).code).toBe('INDEX_REBUILDING');
    await jobDone(jobId);
  });

  it('research retrieveSources tool returns an empty set during rebuild', async () => {
    const { retrieveSourcesTool } = await import('../../src/ai/tools/retrieve-sources.ts');
    let release!: () => void;
    gate = new Promise<void>((r) => {
      release = r;
    });
    const { jobId } = await startIndexRebuild(nb1);
    let result: unknown;
    try {
      const def = retrieveSourcesTool(getOrm(), nb1, async () => new Float32Array(MOCK_DIMS));
      result = await (
        def as unknown as { execute: (args: { query: string; topK: number }) => Promise<unknown> }
      ).execute({ query: '重建期间检索', topK: 3 });
    } finally {
      release();
    }
    expect(result).toEqual([]);
    await jobDone(jobId);
  });

  it('single-source QA returns a degrade notice with degraded=index_rebuilding', async () => {
    let release!: () => void;
    gate = new Promise<void>((r) => {
      release = r;
    });
    const { jobId } = await startIndexRebuild(nb1);
    let body: { degraded?: string; answer?: string } | undefined;
    try {
      const res = await sourceExtrasRouter.handle(
        new Request(`http://local/v2/notebooks/${nb1}/sources/${src11}/qa`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: '这段讲什么' }),
        }),
      );
      expect(res.status).toBe(200);
      body = (await res.json()) as { degraded?: string; answer?: string };
    } finally {
      release();
    }
    expect(body?.degraded).toBe('index_rebuilding');
    expect(body?.answer).toContain('索引重建');
    await jobDone(jobId);
  });
});
