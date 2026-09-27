// architecture-core r8 — the unified TaskQueue HTTP runtime stays retired.
// Requests to /v2/tasks* (notebook task list / cancel) must be unmounted:
// 404 with the unified ErrorEnvelope (equivalent "not mounted" behavior).
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { createApp } from '../../src/server.ts';
import { setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';

let app: InstanceType<typeof createApp>;
let notebookId = 1;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = 424242; // no rows needed — the route itself must not exist
});

afterAll(teardownIntegrationEnv);

interface Envelope {
  errorCode?: string;
  message?: string;
}

async function request(method: string, path: string): Promise<{ status: number; body: Envelope }> {
  const res = await app.handle(new Request(`${BASE}${path}`, { method }));
  const text = await res.text();
  let body: Envelope = {};
  if (text) {
    try {
      body = JSON.parse(text) as Envelope;
    } catch {
      body = {};
    }
  }
  return { status: res.status, body };
}

describe('r8 /v2/tasks* routes stay retired', () => {
  it('GET /v2/tasks is unmounted (404 NOT_FOUND envelope)', async () => {
    // covers: r8
    const { status, body } = await request('GET', '/v2/tasks');
    expect(status).toBe(404);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(typeof body.message).toBe('string');
  });

  it('GET /v2/notebooks/:nid/tasks is unmounted (404 NOT_FOUND envelope)', async () => {
    // covers: r8
    const { status, body } = await request('GET', `/v2/notebooks/${notebookId}/tasks`);
    expect(status).toBe(404);
    expect(body.errorCode).toBe('NOT_FOUND');
  });

  it('POST task cancel under /v2/notebooks/:nid/tasks is unmounted (404)', async () => {
    // covers: r8
    const { status, body } = await request('POST', `/v2/notebooks/${notebookId}/tasks/1/cancel`);
    expect(status).toBe(404);
    expect(body.errorCode).toBe('NOT_FOUND');
  });
});
