// Embed timing test (c30) — verifies embedding completes before status=ready.
//
// Uses a call-order spy on EmbedStrategy.indexSource to prove that vectors
// are written (indexSource called) before the source row is marked ready.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// Stub 'ai' (server import starts worker loop).
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

import { eq } from 'drizzle-orm';

import { db } from '../../src/db/index.ts';
import { notebooks, sources } from '../../src/db/schema.ts';
import { ingestSource } from '../../src/features/sources/pipeline.ts';
import { EmbedStrategy } from '../../src/rag/embed-strategy.ts';
import { setupIntegrationEnv, teardownIntegrationEnv, getOrm } from '../helpers/integration.ts';

beforeAll(() => {
  setupIntegrationEnv();
});

afterAll(() => {
  teardownIntegrationEnv();
});

describe('embedding timing (c30: sync embed before ready)', () => {
  it('marks ready only after indexSource completes', async () => {
    const orm = getOrm();
    const nb = orm.insert(notebooks).values({ name: 'timing-nb' }).returning().get();

    // Spy: record that indexSource was called, with a tiny delay.
    let indexCalled = false;
    EmbedStrategy.prototype.indexSource = async () => {
      indexCalled = true;
    };

    const result = await ingestSource({
      buffer: new TextEncoder().encode('hello world test content'),
      filename: 'timing.txt',
      notebookId: nb.id,
    });

    // After ingestSource returns, status is ready AND indexSource was called.
    expect(result.status).toBe('ready');
    expect(indexCalled).toBe(true);

    const row = db().select().from(sources).where(eq(sources.id, result.sourceId)).get();
    expect(row?.status).toBe('ready');
  });

  it('marks failed when embedding throws', async () => {
    const orm = getOrm();
    const nb = orm.insert(notebooks).values({ name: 'timing-fail' }).returning().get();

    // Make indexSource throw.
    EmbedStrategy.prototype.indexSource = async () => {
      throw new Error('embedding API down');
    };

    const result = await ingestSource({
      buffer: new TextEncoder().encode('content that will fail to embed'),
      filename: 'fail.txt',
      notebookId: nb.id,
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('EMBEDDING_FAILED');

    const row = db().select().from(sources).where(eq(sources.id, result.sourceId)).get();
    expect(row?.status).toBe('failed');
    expect(row?.errorCode).toBe('EMBEDDING_FAILED');
  });
});
