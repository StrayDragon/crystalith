// Deep Research stub: POST create → 501 NOT_IMPLEMENTED (pending rewrite).
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { notebooks } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'research-stub-nb' }).returning().get().id;
});

afterAll(teardownIntegrationEnv);

describe('research stub (pending rewrite)', () => {
  it('POST /v2/notebooks/:nid/research returns 501 NOT_IMPLEMENTED', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: 'anything', maxIterations: 3 }),
      }),
    );
    expect(res.status).toBe(501);
    const body = (await res.json()) as { errorCode?: string; message?: string };
    expect(body.errorCode).toBe('NOT_IMPLEMENTED');
    expect(body.message).toContain('尚未实现');
  });

  it('POST unknown notebook returns 404', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/999999/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: 'x' }),
      }),
    );
    expect(res.status).toBe(404);
  });
});
