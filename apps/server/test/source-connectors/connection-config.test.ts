// Source connector connectionConfig validation (c53 / Wave D.1 regression).
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
  notebookId = getOrm().insert(notebooks).values({ name: 'connector-cfg' }).returning().get().id;
});

afterAll(() => {
  teardownIntegrationEnv();
});

describe('source-connector connectionConfig validation', () => {
  it('rejects missing required vaultPath with 400', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/source-connectors/obsidian/bindings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionConfig: {} }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errorCode?: string; detail?: string };
    expect(body.errorCode).toBe('INVALID_CONFIG');
    expect(String(body.detail)).toMatch(/vaultPath/i);
  });

  it('rejects unknown keys when additionalProperties is false', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/source-connectors/obsidian/bindings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionConfig: { vaultPath: '/tmp/vault', extra: 'nope' },
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errorCode?: string };
    expect(body.errorCode).toBe('INVALID_CONFIG');
  });
});
