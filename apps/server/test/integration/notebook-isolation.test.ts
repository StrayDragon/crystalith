// c67 — notebook isolation: required notebookId + cross-notebook → 404.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { notebooks, outputs, researchSessions, sessions, sources } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookA: number;
let notebookB: number;
let sourceId: number;
let outputId: number;
let researchId: number;
let sessionId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  const orm = getOrm();
  notebookA = orm.insert(notebooks).values({ name: 'nb-a' }).returning().get().id;
  notebookB = orm.insert(notebooks).values({ name: 'nb-b' }).returning().get().id;
  sourceId = orm
    .insert(sources)
    .values({ notebookId: notebookA, filename: 'a.md', status: 'ready' })
    .returning()
    .get().id;
  outputId = orm
    .insert(outputs)
    .values({
      notebookId: notebookA,
      type: 'BRIEFING',
      prompt: 'p',
      content: { text: 'x' },
    })
    .returning()
    .get().id;
  researchId = orm
    .insert(researchSessions)
    .values({ notebookId: notebookA, topic: 't', status: 'planning' })
    .returning()
    .get().id;
  sessionId = orm
    .insert(sessions)
    .values({ notebookId: notebookA, title: 's', sharedStateRevision: 1 })
    .returning()
    .get().id;
});

afterAll(() => {
  teardownIntegrationEnv();
});

async function get(path: string) {
  const res = await app.handle(new Request(`${BASE}${path}`));
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

async function patch(path: string, body: unknown) {
  const res = await app.handle(
    new Request(`${BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
}

async function post(path: string, body: unknown) {
  const res = await app.handle(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
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

describe('c67 notebook isolation', () => {
  it('GET /v2/sources/:id cross-notebook → 404 ErrorEnvelope', async () => {
    const { status, body } = await get(`/v2/sources/${sourceId}?notebookId=${notebookB}`);
    expect(status).toBe(404);
    expect((body as { errorCode: string }).errorCode).toBe('NOT_FOUND');
  });

  it('GET /v2/sources/:id missing notebookId → validation reject', async () => {
    const { status, body } = await get(`/v2/sources/${sourceId}`);
    expect(status).toBe(422);
    expect((body as { errorCode: string }).errorCode).toBe('SCHEMA_VALIDATION_FAILED');
  });

  it('GET /v2/sources/:id same notebook → 200', async () => {
    const { status, body } = await get(`/v2/sources/${sourceId}?notebookId=${notebookA}`);
    expect(status).toBe(200);
    expect((body as { id: number }).id).toBe(sourceId);
  });

  it('GET /v2/outputs/:id cross-notebook → 404 ErrorEnvelope', async () => {
    const { status, body } = await get(`/v2/outputs/${outputId}?notebookId=${notebookB}`);
    expect(status).toBe(404);
    expect((body as { errorCode: string }).errorCode).toBe('NOT_FOUND');
  });

  it('GET /v2/outputs/:id missing notebookId → validation reject', async () => {
    const { status } = await get(`/v2/outputs/${outputId}`);
    expect(status).toBe(422);
  });

  it('GET /v2/research missing notebookId → reject (no global dump)', async () => {
    const { status, body } = await get('/v2/research');
    expect(status).toBe(422);
    expect((body as { errorCode: string }).errorCode).toBe('SCHEMA_VALIDATION_FAILED');
  });

  it('GET /v2/research/:id cross-notebook → 404', async () => {
    const { status, body } = await get(`/v2/research/${researchId}?notebookId=${notebookB}`);
    expect(status).toBe(404);
    expect((body as { errorCode: string }).errorCode).toBe('NOT_FOUND');
  });

  it('GET /v2/research?notebookId=A returns only A sessions', async () => {
    const { status, body } = await get(`/v2/research?notebookId=${notebookA}`);
    expect(status).toBe(200);
    const page = body as { items: Array<{ id: number; notebookId: number }> };
    expect(page.items.some((r) => r.id === researchId)).toBe(true);
    expect(page.items.every((r) => r.notebookId === notebookA)).toBe(true);
  });

  it('session optimistic lock conflict → 409 CONFLICT', async () => {
    const { status, body } = await patch(`/v2/notebooks/${notebookA}/sessions/${sessionId}`, {
      sharedStateRevision: 0,
      sharedState: { x: 1 },
    });
    expect(status).toBe(409);
    expect((body as { errorCode: string }).errorCode).toBe('CONFLICT');
  });
});

describe('c69 nested notebook paths', () => {
  it('GET nested outputs list for notebook A', async () => {
    const { status, body } = await get(`/v2/notebooks/${notebookA}/outputs`);
    expect(status).toBe(200);
    const page = body as { items: Array<{ id: number; notebookId: number }> };
    expect(page.items.some((o) => o.id === outputId)).toBe(true);
    expect(page.items.every((o) => o.notebookId === notebookA)).toBe(true);
  });

  it('GET nested output with wrong notebook → 404', async () => {
    const { status, body } = await get(`/v2/notebooks/${notebookB}/outputs/${outputId}`);
    expect(status).toBe(404);
    expect((body as { errorCode: string }).errorCode).toBe('NOT_FOUND');
  });

  it('GET nested source by sid', async () => {
    const { status, body } = await get(`/v2/notebooks/${notebookA}/sources/${sourceId}`);
    expect(status).toBe(200);
    expect((body as { id: number }).id).toBe(sourceId);
  });

  it('POST nested outputs with mismatched body notebookId → 400', async () => {
    const { status, body } = await post(`/v2/notebooks/${notebookA}/outputs`, {
      notebookId: notebookB,
      type: 'BRIEFING',
      sourceIds: [sourceId],
    });
    expect(status).toBe(400);
    expect((body as { errorCode: string }).errorCode).toBe('INVALID_REQUEST');
  });

  it('POST nested research without body notebookId → 201 with path nid', async () => {
    const { status, body } = await post(`/v2/notebooks/${notebookA}/research`, {
      topic: 'c69 omit body notebookId',
      maxIterations: 1,
    });
    expect(status).toBe(201);
    const created = body as { id: number; notebookId: number };
    expect(created.notebookId).toBe(notebookA);
    // Cancel so background agent does not race later tests.
    const cancel = await post(`/v2/notebooks/${notebookA}/research/${created.id}/cancel`);
    expect(cancel.status).toBe(200);
  });

  it('GET flat outputs alias still works while nested is canonical', async () => {
    const { status, body } = await get(`/v2/outputs?notebookId=${notebookA}`);
    expect(status).toBe(200);
    const page = body as { items: Array<{ id: number }> };
    expect(page.items.some((o) => o.id === outputId)).toBe(true);
  });

  it('GET /v2/outputs/types stays global flat', async () => {
    const { status, body } = await get('/v2/outputs/types');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});
