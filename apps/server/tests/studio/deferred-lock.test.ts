// c124 — deferred testable batch, server-side lock tests:
//   r250 — sync_check snapshot diff uses deterministic lightweight rules
//   r252 — unavailable connector → 409 with hint + pluginDiagnostic
//   r254 — ready source guarantees retrievability (chunks + vector hit)
//   r310 — busy guard event + stale-running cleanup semantics
//   r316 — slide serialization carries outputId + generationConfig
//   r317 — SSE done payload is {traceId, slideId}, never the full slide
//
// Self-contained per the --parallel isolation discipline: 'ai' and embedder
// mocks are installed BEFORE importing server modules.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

mock.module('ai', () => {
  const MOCK_VECTOR = Array.from({ length: 1024 }, () => 0.01);
  return {
    Output: { object: <T>(spec: T) => spec },
    generateObject: async () => ({ object: {} }),
    generateText: async () => ({ text: 'mocked' }),
    streamText: () => {
      const parts = (async function* () {
        yield { type: 'text-delta', text: 'mocked' };
      })();
      return { stream: parts, fullStream: parts, textStream: parts };
    },
    embed: async () => ({ embedding: MOCK_VECTOR }),
    embedMany: async ({ values }: { values: string[] }) => ({
      embeddings: values.map(() => MOCK_VECTOR),
    }),
    tool: (def: unknown) => def,
    ToolLoopAgent: class {
      async generate() {
        return { text: 'mocked' };
      }
    },
    isStepCount: () => ({ stopWhen: 'stepCount' }),
    wrapLanguageModel: ({ model }: { model: unknown }) => model,
  };
});
mock.module('../../src/rag/embedder.ts', () => ({
  getEmbedModel: async () => null,
  embedSingle: async () => new Float32Array(1024),
  embedBatch: async (texts: string[]) => texts.map(() => new Float32Array(1024)),
}));

import { eq } from 'drizzle-orm';

import { chunks, notebooks, sources, studioSlides } from '../../src/db/schema.ts';
import { buildSyncCandidates } from '../../src/features/source-connectors/sync.ts';
import { ingestSource } from '../../src/features/sources/pipeline.ts';
import { clearStaleRunning, createSseResponse } from '../../src/features/studio/service.ts';
import { createApp } from '../../src/server.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  resetConfig({
    models: {
      defaults: { chat: 'test-chat', embedding: 'test-embed' },
      available: [
        {
          id: 'test-chat',
          provider: 'openai',
          model: 'gpt-4o-test',
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
          providerConfig: { apiKey: 'test-key' },
        },
      ],
    },
    raw: {},
  });
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'c124-lock' }).returning().get().id;
});

afterAll(() => {
  teardownIntegrationEnv();
});

// ---------------------------------------------------------------------------
// r250 — snapshot diff
// ---------------------------------------------------------------------------

describe('r250 sync_check snapshot diff is deterministic and lightweight', () => {
  it('classifies added/updated/missing from path + sizeBytes/modifiedAt, sorted by path', () => {
    // covers: r250
    const base = {
      generatedAt: '2026-09-29T00:00:00Z',
      entries: [
        { relativePath: 'b.md', sizeBytes: 10, modifiedAt: '2026-09-28T00:00:00Z' },
        { relativePath: 'gone.md', sizeBytes: 5, modifiedAt: '2026-09-28T00:00:00Z' },
        { relativePath: 'same.md', sizeBytes: 7, modifiedAt: '2026-09-28T00:00:00Z' },
      ],
    };
    const current = {
      generatedAt: '2026-09-29T01:00:00Z',
      entries: [
        { relativePath: 'a-new.md', sizeBytes: 3, modifiedAt: '2026-09-29T00:00:00Z' },
        { relativePath: 'b.md', sizeBytes: 10, modifiedAt: '2026-09-29T00:30:00Z' },
        { relativePath: 'same.md', sizeBytes: 7, modifiedAt: '2026-09-28T00:00:00Z' },
      ],
    };
    const result = buildSyncCandidates(base, current);
    expect(result.added.map((c) => c.relativePath)).toEqual(['a-new.md']);
    expect(result.updated.map((c) => c.relativePath)).toEqual(['b.md']);
    expect(result.updated[0].reason).toContain('modified_at 变化');
    expect(result.missing.map((c) => c.relativePath)).toEqual(['gone.md']);
    // identical entries (path + sizeBytes + modifiedAt) produce no candidates
    expect(result.added).not.toContainEqual(expect.objectContaining({ relativePath: 'same.md' }));
  });

  it('sorts multiple candidates deterministically by relativePath', () => {
    // covers: r250
    const mk = (paths: string[]) => ({
      generatedAt: 't',
      entries: paths.map((p) => ({ relativePath: p, sizeBytes: 1, modifiedAt: 'm' })),
    });
    const result = buildSyncCandidates(mk([]), mk(['z.md', 'a.md', 'm.md']));
    expect(result.added.map((c) => c.relativePath)).toEqual(['a.md', 'm.md', 'z.md']);
  });
});

// ---------------------------------------------------------------------------
// r252 — unavailable connector 409
// ---------------------------------------------------------------------------

describe('r252 unavailable connector returns 409 with install hint', () => {
  it('connector endpoints answer 409 CONNECTOR_UNAVAILABLE + hint + pluginDiagnostic', async () => {
    // covers: r252
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/source-connectors/does-not-exist/bindings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rootPath: '/tmp/vault' }),
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      errorCode: string;
      details?: { hint?: string; pluginDiagnostic?: { connectorId: string; loaded: boolean } };
    };
    expect(body.errorCode).toBe('CONNECTOR_UNAVAILABLE');
    expect(body.details?.hint).toContain('does-not-exist');
    expect(body.details?.pluginDiagnostic).toEqual({
      connectorId: 'does-not-exist',
      loaded: false,
    });
  });
});

// ---------------------------------------------------------------------------
// r254 — ready ⇒ retrievable
// ---------------------------------------------------------------------------

describe('r254 ready source has persisted chunks and retrievable vectors', () => {
  it('an ingested ready source yields chunks whose vectors are retrievable', async () => {
    // covers: r254
    const result = await ingestSource({
      buffer: new TextEncoder().encode('c124 retrievability probe — unique marker phrase'),
      filename: 'probe.txt',
      notebookId,
      mimeType: 'text/plain',
    });
    expect(result.status).toBe('ready');

    const row = getOrm().select().from(sources).where(eq(sources.id, result.sourceId)).get();
    expect(row?.status).toBe('ready');

    const chunkRows = getOrm()
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, result.sourceId))
      .all();
    expect(chunkRows.length).toBeGreaterThan(0);

    // Vector hit: sqlite-vec nearest-neighbor within the notebook scope
    // (probe vector ≡ the constant vectors the embedder stub stored).
    const { searchVectors } = await import('../../src/db/vectors.ts');
    const hits = searchVectors(getOrm(), new Float32Array(1024), notebookId, 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.source_id === result.sourceId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// r310 / r317 — studio busy/stale + done payload
// ---------------------------------------------------------------------------

async function parseSse(
  response: Response,
): Promise<Array<{ event: string; data: Record<string, unknown> }>> {
  const text = await response.text();
  const frames: Array<{ event: string; data: Record<string, unknown> }> = [];
  for (const block of text.split('\n\n')) {
    const event = block.match(/^event: (.+)$/mu)?.[1];
    const data = block.match(/^data: (.+)$/mu)?.[1];
    if (event && data) frames.push({ event, data: JSON.parse(data) as Record<string, unknown> });
  }
  return frames;
}

describe('r310 busy and stale-running handling is explicit', () => {
  it('a running (non-stale) slide gets a busy SSE event, not a second stream', async () => {
    // covers: r310
    const orm = getOrm();
    const slideId = orm
      .insert(studioSlides)
      .values({ notebookId, title: 'busy', status: 'running' })
      .returning()
      .get().id;

    const response = createSseResponse(slideId, async () => {
      throw new Error('run must not start while busy');
    });
    const frames = await parseSse(response);
    expect(frames[0]?.event).toBe('busy');
    expect(frames[0]?.data.message).toContain('生成中');
    expect(frames[0]?.data.slideId).toBe(slideId);
    // every SSE event carries traceId for correlation (r317 SHALL clause)
    expect(typeof frames[0]?.data.traceId).toBe('string');
  });

  it('stale running is cleaned to idle with null errorMessage and returns true', async () => {
    // covers: r310
    const orm = getOrm();
    const staleId = orm
      .insert(studioSlides)
      .values({
        notebookId,
        title: 'stale',
        status: 'running',
        errorMessage: 'leftover diagnostic',
        updatedAt: new Date(Date.now() - 11 * 60 * 1000),
      })
      .returning()
      .get().id;
    expect(clearStaleRunning(staleId)).toBe(true);
    const row = orm.select().from(studioSlides).where(eq(studioSlides.id, staleId)).get();
    expect(row?.status).toBe('idle');
    expect(row?.errorMessage).toBeNull();

    // non-running slides clear trivially (idempotent true)
    expect(clearStaleRunning(staleId)).toBe(true);
  });

  it('fresh running slides are not treated as stale', async () => {
    // covers: r310
    const orm = getOrm();
    const freshId = orm
      .insert(studioSlides)
      .values({ notebookId, title: 'fresh', status: 'running' })
      .returning()
      .get().id;
    expect(clearStaleRunning(freshId)).toBe(false);
  });
});

describe('r317 studio SSE done payload is {traceId, slideId} only', () => {
  it('done carries traceId + slideId and never the serialized slide', async () => {
    // covers: r317
    const orm = getOrm();
    const slideId = orm
      .insert(studioSlides)
      .values({ notebookId, title: 'done-shape', status: 'idle' })
      .returning()
      .get().id;

    const response = createSseResponse(slideId, async (emit) => {
      emit('done', { slideId });
    });
    const frames = await parseSse(response);
    const done = frames.find((f) => f.event === 'done');
    expect(done).toBeDefined();
    expect(typeof done?.data.traceId).toBe('string');
    expect(done?.data.slideId).toBe(slideId);
    // must not serialize the whole slide entity
    expect(done?.data.markdown).toBeUndefined();
    expect(done?.data.generationConfig).toBeUndefined();
    expect(Object.keys(done?.data ?? {}).toSorted()).toEqual(['slideId', 'traceId']);
  });
});

// ---------------------------------------------------------------------------
// r316 — slide serialization shape
// ---------------------------------------------------------------------------

describe('r316 slide serialization includes outputId and generationConfig', () => {
  it('GET slide returns camelCase outputId (nullable) + generationConfig', async () => {
    // covers: r316
    const orm = getOrm();
    const slideId = orm
      .insert(studioSlides)
      .values({
        notebookId,
        title: 'serialization',
        status: 'idle',
        generationConfig: { tone: 'professional', preference: 'quality' },
      })
      .returning()
      .get().id;

    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/studio/slides/${slideId}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect('outputId' in body).toBe(true);
    expect('generationConfig' in body).toBe(true);
    expect(body.generationConfig).toEqual({ tone: 'professional', preference: 'quality' });

    // null-outputId slides still carry the key (frontend slide→output jump reads it)
    const nullSlideId = orm
      .insert(studioSlides)
      .values({ notebookId, title: 'no-output', status: 'idle' })
      .returning()
      .get().id;
    const res2 = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/studio/slides/${nullSlideId}`),
    );
    const body2 = (await res2.json()) as Record<string, unknown>;
    expect('outputId' in body2).toBe(true);
    expect(body2.outputId).toBeNull();
  });
});
