// Regression: malformed JSON request bodies must return 400 INVALID_REQUEST
// with the ErrorEnvelope shape — not the 500 INTERNAL_ERROR fallthrough.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { createApp } from '../../src/server.ts';
import { setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';

beforeAll(() => {
  setupIntegrationEnv();
});

afterAll(teardownIntegrationEnv);

describe('malformed JSON body → 400', () => {
  it('returns INVALID_REQUEST envelope for unparseable JSON', async () => {
    const app = createApp();
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"name": "unterminated',
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errorCode?: string; message?: string };
    expect(body.errorCode).toBe('INVALID_REQUEST');
    expect(typeof body.message).toBe('string');
  });
});
