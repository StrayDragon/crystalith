// c132 r485 (seam ⑤) — output auto-indexing lifecycle:
//   create → hidden derived row, ready, chunks origin='output', searchable;
//   embed failure → derived failed + derivedFailedCount, generation untouched;
//   delete → derived row / chunks / vectors / FTS all gone (no orphans).
// Hermetic: mock.module('ai') embedMany before importing server modules; temp
// DB via setupIntegrationEnv with a seeded tiny-dims embedding model.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

const DIMS = 4;

let embedShouldFail = false;

mock.module('ai', () => ({
  embed: async () => ({
    embedding: Array.from({ length: DIMS }, (_, i) => (i === 0 ? 1 : 0)),
  }),
  embedMany: async ({ values }: { values: string[] }) => {
    if (embedShouldFail) throw new Error('embedding provider down');
    return {
      embeddings: values.map((_, i) =>
        Array.from({ length: DIMS }, (_, j) => (j === i % DIMS ? 1 : 0)),
      ),
    };
  },
}));

import { ftsSearch } from '../../src/db/fts.ts';
import { notebooks, outputs, sources } from '../../src/db/schema.ts';
import { countVectors } from '../../src/db/vectors.ts';
import { indexOutputForSearch } from '../../src/features/outputs/auto-index.ts';
import { createApp } from '../../src/server.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

beforeAll(() => {
  resetConfig({
    models: {
      defaults: { embedding: 'test-embed' },
      available: [
        {
          id: 'test-embed',
          provider: 'openai',
          model: 'bge-test',
          displayName: 'Test Embed',
          roles: ['embed'],
          capabilities: [],
          embedding: { dims: DIMS, modalities: ['text'] },
          providerConfig: { apiKey: 'test-key' },
        },
      ],
    },
    raw: {},
  });
  setupIntegrationEnv();
});

afterAll(() => {
  teardownIntegrationEnv();
  resetConfig();
});

function seedNotebook(name: string): number {
  return getOrm().insert(notebooks).values({ name }).returning().get().id;
}

function seedOutput(
  nid: number,
  id?: number,
): { id: number; notebookId: number; type: string; prompt: string | null; content: unknown } {
  const values: Record<string, unknown> = {
    notebookId: nid,
    type: 'GUIDE',
    prompt: '写一份检索指南',
    content: { title: '检索指南', sections: [{ title: '语义', content: '向量检索实践要点' }] },
  };
  if (id !== undefined) values.id = id;
  const row = getOrm()
    .insert(outputs)
    .values(values as never)
    .returning()
    .get();
  return row as never;
}

describe('r485 output auto-indexing lifecycle', () => {
  it('indexes synchronously into a hidden ready derived row', async () => {
    const nid = seedNotebook('t4-ok');
    const out = seedOutput(nid);

    await indexOutputForSearch(out);

    const orm = getOrm();
    const derived = orm
      .select()
      .from(sources)
      .all()
      .find((s) => s.derivedOutputId === out.id);
    expect(derived).toBeDefined();
    expect(derived!.status).toBe('ready'); // rebuild enumeration covers it
    expect(derived!.filename).toBe(`GUIDE-${out.id}`);

    const derivedChunks = orm
      .select()
      .from((await import('../../src/db/schema.ts')).chunks)
      .all()
      .filter((c) => c.sourceId === derived!.id);
    expect(derivedChunks.length).toBeGreaterThan(0);
    for (const c of derivedChunks) {
      expect(c.originType).toBe('output');
      expect(c.originId).toBe(out.id);
      expect(c.textTokens).toBeTruthy();
    }
    // Vectorized + keyword-searchable (unrestricted scope).
    expect(await countVectors(orm, nid)).toBeGreaterThan(0);
    const kw = await ftsSearch(orm, '向量检索', { notebookId: nid, topK: 10 });
    expect(kw.length).toBeGreaterThan(0);

    // Hidden from the notebook sources list endpoint.
    const app = createApp();
    const res = await app.handle(new Request(`http://localhost/v2/notebooks/${nid}/sources`));
    const body = (await res.json()) as { items: Array<{ id: number; filename: string }> };
    expect(body.items.some((i) => i.id === derived!.id)).toBe(false);
  });

  it('embed failure marks derived failed + surfaced count; generation untouched', async () => {
    const nid = seedNotebook('t4-fail');
    const out = seedOutput(nid);

    embedShouldFail = true;
    try {
      await expect(indexOutputForSearch(out)).resolves.toBeUndefined();
    } finally {
      embedShouldFail = false;
    }

    const derived = getOrm()
      .select()
      .from(sources)
      .all()
      .find((s) => s.derivedOutputId === out.id);
    expect(derived!.status).toBe('failed');
    expect(derived!.errorMessage).toBeTruthy();

    const app = createApp();
    const res = await app.handle(new Request(`http://localhost/v2/notebooks/${nid}/search-index`));
    const body = (await res.json()) as { derivedFailedCount?: number };
    expect(body.derivedFailedCount).toBe(1);
  });

  it('output delete cascades the derived row, chunks, vectors and FTS', async () => {
    const nid = seedNotebook('t4-del');
    const out = seedOutput(nid);
    await indexOutputForSearch(out);

    const orm = getOrm();
    const derivedId = orm
      .select()
      .from(sources)
      .all()
      .find((s) => s.derivedOutputId === out.id)!.id;
    expect(
      (await ftsSearch(orm, '向量检索', { notebookId: nid, topK: 10 })).length,
    ).toBeGreaterThan(0);

    const app = createApp();
    const res = await app.handle(
      new Request(`http://localhost/v2/notebooks/${nid}/outputs/${out.id}`, { method: 'DELETE' }),
    );
    expect(res.status).toBe(204);

    expect(
      getOrm()
        .select()
        .from(sources)
        .all()
        .find((s) => s.id === derivedId),
    ).toBeUndefined();
    expect(await countVectors(orm, nid)).toBe(0);
    expect(await ftsSearch(orm, '向量检索', { notebookId: nid, topK: 10 })).toHaveLength(0);
    // The derived chunks went with the row (FTS trigger path proven above).
    const { chunks } = await import('../../src/db/schema.ts');
    expect(
      getOrm()
        .select()
        .from(chunks)
        .all()
        .filter((c) => c.sourceId === derivedId),
    ).toHaveLength(0);
  });
});
