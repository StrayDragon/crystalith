// retrieval-and-cache r232 — epoch cache is wired to source mutations and
// re-embedding (never dead code):
//   - source delete (mutation) bumps sources_epoch → cached retrievals drop
//   - EmbedStrategy.indexSource (re-embed) bumps vector_epoch → same effect
//
// Behavioral proof: seed the module-level retrieval cache, perform the real
// mutation (HTTP delete / real indexSource with a mocked 'ai' embed), then
// observe the previously-cached entry is no longer hit.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

const MOCK_VECTOR = Array.from({ length: 1024 }, () => 0.01);

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked' }),
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  embed: async () => ({ embedding: MOCK_VECTOR }),
  embedMany: async ({ values }: { values: string[] }) => ({
    embeddings: values.map(() => MOCK_VECTOR),
  }),
  tool: (def: unknown) => def,
}));

import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { clearCache, getCached, setCached } from '../../src/rag/cache.ts';
import { EmbedStrategy } from '../../src/rag/embed-strategy.ts';
import type { ChunkResult } from '../../src/rag/types.ts';
import { createApp } from '../../src/server.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const CACHED_HIT: ChunkResult[] = [
  { chunkId: 1, text: 'cached', score: 0.9, sourceId: 1, chunkIndex: 0 },
];

let app: InstanceType<typeof createApp>;

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
});

afterAll(() => {
  teardownIntegrationEnv();
  resetConfig();
  clearCache();
});

describe('r232 epoch cache wired to source mutations', () => {
  it('deleting a source bumps sources_epoch so cached entries no longer hit', async () => {
    // covers: r232
    const orm = getOrm();
    const nbId = orm.insert(notebooks).values({ name: 'epoch-src-nb' }).returning().get().id;
    const sourceId = orm
      .insert(sources)
      .values({ notebookId: nbId, filename: 'doomed.md', status: 'ready' })
      .returning()
      .get().id;

    setCached(nbId, 'probe', 'p', CACHED_HIT);
    expect(getCached(nbId, 'probe', 'p')).toBeDefined();

    const res = await app.handle(
      new Request(`http://test.local/v2/notebooks/${nbId}/sources/${sourceId}`, {
        method: 'DELETE',
      }),
    );
    expect(res.status).toBe(204);
    // The source mutation went through the epoch bump — cache is invalidated.
    expect(getCached(nbId, 'probe', 'p')).toBeUndefined();
  });

  it('re-embedding a source bumps vector_epoch so cached entries no longer hit', async () => {
    // covers: r232
    const orm = getOrm();
    const nbId = orm.insert(notebooks).values({ name: 'epoch-vec-nb' }).returning().get().id;
    const sourceId = orm
      .insert(sources)
      .values({ notebookId: nbId, filename: 'reembed.md', status: 'ready' })
      .returning()
      .get().id;
    orm.insert(chunks).values({ sourceId, chunkIndex: 0, text: 'chunk to embed' }).run();

    setCached(nbId, 'probe', 'p', CACHED_HIT);
    expect(getCached(nbId, 'probe', 'p')).toBeDefined();

    await new EmbedStrategy().indexSource(sourceId, nbId);
    // indexSource stored fresh vectors and bumped the notebook's vector_epoch.
    expect(getCached(nbId, 'probe', 'p')).toBeUndefined();
  });
});
