// Regression: DELETE /v2/notebooks/:nid must drop the notebook's vectors too.
// vec_chunks has no FK — before the fix, notebook cascade deleted sources and
// chunks rows but leaked their vectors forever.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { countVectors, insertChunkVector } from '../../src/db/vectors.ts';
import { createApp } from '../../src/server.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';

beforeAll(() => {
  setupIntegrationEnv();
});

afterAll(() => {
  teardownIntegrationEnv();
});

describe('notebook delete cleans vectors', () => {
  it('DELETE /v2/notebooks/:nid removes vec_chunks rows of its sources', async () => {
    const app = createApp();
    const orm = getOrm();

    const notebookId = orm.insert(notebooks).values({ name: 'vec-leak-nb' }).returning().get().id;
    const sourceId = orm
      .insert(sources)
      .values({ notebookId, filename: 'leak.txt', status: 'ready' })
      .returning()
      .get().id;
    const chunkId = orm
      .insert(chunks)
      .values({ sourceId, chunkIndex: 0, text: 'vector leak probe' })
      .returning()
      .get().id;
    const vec = new Float32Array(1024);
    vec[0] = 1;
    insertChunkVector(orm, chunkId, notebookId, sourceId, vec);
    expect(countVectors(orm, notebookId)).toBe(1);

    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}`, { method: 'DELETE' }),
    );
    expect(res.status).toBe(204);
    expect(countVectors(orm, notebookId)).toBe(0);
  });
});
