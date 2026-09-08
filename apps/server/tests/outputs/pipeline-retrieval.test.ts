// Output pipeline retrieval — scoped RAG miss falls back to direct source chunks.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { eq } from 'drizzle-orm';

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked' }),
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
}));

import { db } from '../../src/db/index.ts';
import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import {
  fetchChunksBySourceIds,
  resolvePipelineContextChunks,
} from '../../src/features/outputs/pipeline.ts';
import {
  setupIntegrationEnv,
  teardownIntegrationEnv,
  stubEmbedding,
} from '../helpers/integration.ts';

beforeAll(async () => {
  setupIntegrationEnv();
  await stubEmbedding();
});

afterAll(() => {
  teardownIntegrationEnv();
});

describe('resolvePipelineContextChunks', () => {
  it('falls back to direct chunks when scoped RAG returns empty', async () => {
    const nb = db().insert(notebooks).values({ name: 'pipeline-fallback' }).returning().get().id;
    const source = db()
      .insert(sources)
      .values({
        notebookId: nb,
        filename: 'note.txt',
        mimeType: 'text/plain',
        parserType: 'text',
        status: 'ready',
      })
      .returning()
      .get();
    db()
      .insert(chunks)
      .values({
        sourceId: source.id,
        chunkIndex: 0,
        text: 'Attention Is All You Need — transformer architecture overview.',
      })
      .run();

    const rows = await resolvePipelineContextChunks({
      model: {} as never,
      notebookId: nb,
      type: 'TIMELINE',
      sourceIds: [source.id],
      prompt: 'timeline please',
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.text).toContain('Attention');
  });
});

describe('fetchChunksBySourceIds', () => {
  it('returns chunks scoped to notebook + source ids', () => {
    const nb = db().insert(notebooks).values({ name: 'pipeline-direct' }).returning().get().id;
    const source = db()
      .insert(sources)
      .values({
        notebookId: nb,
        filename: 'direct.txt',
        mimeType: 'text/plain',
        parserType: 'text',
        status: 'ready',
      })
      .returning()
      .get();
    db()
      .insert(chunks)
      .values({ sourceId: source.id, chunkIndex: 0, text: 'direct chunk body' })
      .run();

    const rows = fetchChunksBySourceIds(nb, [source.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe('direct chunk body');
  });
});
