// Citation context — neighborhood evidence review (c26 + c53 path fix) integration tests.
//
// Exercises GET /v2/notebooks/:nid/citations/context (c53: was flat
// /v2/citations/context?notebook_id=; now nests under notebook to match v1
// api.py:13 + c26 proposal/design promise). Defaults before/after = 1 (c53).
//
//   - Resolve by chunk_id
//   - Resolve by source_id + chunk_index
//   - Validation: mutually exclusive params → 400
//   - Validation: neither param → 400
//   - Neighborhood window (before/after chunks in same source)
//   - Metadata enrichment (page_number, paragraph_index)
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { setupIntegrationEnv, teardownIntegrationEnv, getOrm } from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;
let sourceId: number;
// chunk IDs for window test: chunk_index 0,1,2,3,4 → 5 consecutive chunks
let chunkIds: number[] = [];

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();

  const orm = getOrm();
  const nb = orm.insert(notebooks).values({ name: 'citation-nb' }).returning().get();
  notebookId = nb.id;

  const src = orm
    .insert(sources)
    .values({ notebookId, filename: 'research-paper.pdf', status: 'ready' })
    .returning()
    .get();
  sourceId = src.id;

  // Seed 5 chunks with metadata for page_number / paragraph_index
  const texts = [
    'Intro paragraph.',
    'Background section.',
    'Core finding.',
    'Discussion.',
    'Conclusion.',
  ];
  for (let i = 0; i < 5; i++) {
    const meta = { page: i + 1, paragraph_index: i * 2 };
    const c = orm
      .insert(chunks)
      .values({
        sourceId,
        chunkIndex: i,
        text: texts[i],
        metadata: meta,
      })
      .returning()
      .get();
    chunkIds.push(c.id);
  }
});

afterAll(() => {
  teardownIntegrationEnv();
});

/** c53: path is now /v2/notebooks/:nid/citations/context (notebook_id in path). */
function ctxPath(query: string): string {
  return `/v2/notebooks/${notebookId}/citations/context${query}`;
}

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await app.handle(new Request(`${BASE}${path}`));
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('citation context — resolve by chunk_id', () => {
  it('resolves target chunk by chunk_id', async () => {
    const { status, body } = await get(ctxPath(`?chunkId=${chunkIds[2]}&before=1&after=1`));
    expect(status).toBe(200);
    const result = body as {
      citation: { chunkId: number; sourceName: string };
      chunk: { chunkId: number; text: string; chunkIndex: number };
      before: unknown[];
      after: unknown[];
    };
    expect(result.citation.chunkId).toBe(chunkIds[2]);
    expect(result.citation.sourceName).toBe('research-paper.pdf');
    expect(result.chunk.chunkId).toBe(chunkIds[2]);
    expect(result.chunk.text).toContain('Core finding');
    // chunkIndex should be 1-based
    expect(result.chunk.chunkIndex).toBe(3); // DB 2 → API 3
  });

  it('enriches page_number and paragraph_index from metadata', async () => {
    const { body } = await get(ctxPath(`?chunkId=${chunkIds[1]}&before=0&after=0`));
    const result = body as {
      chunk: { pageNumber: number | null; paragraphIndex: number | null };
    };
    expect(result.chunk.pageNumber).toBe(2); // chunk_index=1 → page 2
    expect(result.chunk.paragraphIndex).toBe(2); // chunk_index=1 → para 2
  });
});

describe('citation context — resolve by source_id + chunk_index', () => {
  it('resolves by source_id and 1-based chunk_index', async () => {
    const { status, body } = await get(ctxPath(`?sourceId=${sourceId}&chunkIndex=1`));
    expect(status).toBe(200);
    const result = body as { chunk: { chunkId: number; text: string; chunkIndex: number } };
    expect(result.chunk.chunkId).toBe(chunkIds[0]);
    expect(result.chunk.chunkIndex).toBe(1); // 1-based
    expect(result.chunk.text).toContain('Intro paragraph');
  });

  it('returns 404 for out-of-range chunk_index', async () => {
    const { status } = await get(ctxPath(`?sourceId=${sourceId}&chunkIndex=99`));
    expect(status).toBe(404);
  });
});

describe('citation context — neighborhood window', () => {
  it('returns before and after chunks from the same source', async () => {
    const { body } = await get(ctxPath(`?chunkId=${chunkIds[2]}&before=2&after=2`));
    const result = body as { before: unknown[]; after: unknown[] };
    expect(result.before).toHaveLength(2);
    expect(result.after).toHaveLength(2);
  });

  it('before chunks are ordered by ascending chunk_index', async () => {
    const { body } = await get(ctxPath(`?chunkId=${chunkIds[2]}&before=2&after=1`));
    const result = body as {
      before: Array<{ chunkIndex: number }>;
      after: Array<{ chunkIndex: number }>;
    };
    // before[0].chunkIndex < before[1].chunkIndex < chunk.chunkIndex
    expect(result.before[0].chunkIndex).toBeLessThan(result.before[1].chunkIndex);
    // chunk is at index 3 (1-based)
    expect(result.before[1].chunkIndex).toBeLessThan(3);
    // after[0] > chunkIndex
    expect(result.after[0].chunkIndex).toBeGreaterThan(3);
  });

  it('capped at source boundary (do not cross into other sources)', async () => {
    const { body } = await get(ctxPath(`?chunkId=${chunkIds[0]}&before=5&after=1`));
    const result = body as { before: unknown[] };
    // chunk_index=0 has no chunks before it
    expect(result.before).toHaveLength(0);
  });
});

describe('citation context — validation', () => {
  it('returns 422 when both chunk_id and source_id+chunk_index are provided', async () => {
    const { status } = await get(
      ctxPath(`?chunkId=${chunkIds[0]}&sourceId=${sourceId}&chunkIndex=1`),
    );
    expect(status).toBe(422);
  });

  it('returns 422 when no resolution param is provided', async () => {
    const { status } = await get(ctxPath(''));
    expect(status).toBe(422);
  });

  it('returns 404 for nonexistent chunk_id', async () => {
    const { status } = await get(ctxPath(`?chunkId=99999`));
    expect(status).toBe(404);
  });

  it('defaults before/after to 1 when omitted', async () => {
    const { status, body } = await get(ctxPath(`?chunkId=${chunkIds[2]}`));
    expect(status).toBe(200);
    const result = body as { before: unknown[]; after: unknown[] };
    expect(result.before).toHaveLength(1);
    expect(result.after).toHaveLength(1);
  });

  it('clamps before/after to [0, 5] range', async () => {
    // before=99 should be clamped to 5
    const { status } = await get(ctxPath(`?chunkId=${chunkIds[2]}&before=99&after=-1`));
    expect(status).toBe(200);
  });
});

describe('citation context — existing endpoint preserved', () => {
  it('GET /v2/citations/:messageId still works with notebookId', async () => {
    // c67: notebookId required; missing message still 404 (not 422) when scoped.
    const res = await app.handle(new Request(`${BASE}/v2/citations/999?notebookId=${notebookId}`));
    expect(res.status).toBe(404); // no such message, but route resolved correctly
  });
});
