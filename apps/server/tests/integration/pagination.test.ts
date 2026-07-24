// c68 — list endpoints return PaginatedSchema envelope { items, total, offset, limit }.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import {
  messages,
  notebooks,
  outputs,
  sessions,
  sources,
  studioSlides,
} from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;
let sessionId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  const orm = getOrm();
  notebookId = orm.insert(notebooks).values({ name: 'c68-nb' }).returning().get().id;
  sessionId = orm.insert(sessions).values({ notebookId, title: 's1' }).returning().get().id;

  for (let i = 0; i < 5; i++) {
    orm
      .insert(messages)
      .values({ sessionId, role: 'user', content: `m${i}` })
      .run();
    orm
      .insert(sessions)
      .values({ notebookId, title: `extra-${i}` })
      .run();
    orm
      .insert(sources)
      .values({ notebookId, filename: `f${i}.md`, status: 'ready' })
      .run();
    orm
      .insert(outputs)
      .values({
        notebookId,
        type: 'BRIEFING',
        prompt: `p${i}`,
        content: { text: `o${i}` },
      })
      .run();
    orm
      .insert(studioSlides)
      .values({
        notebookId,
        title: `slide-${i}`,
        stage: 'input',
        status: 'idle',
        sourceIds: [],
      })
      .run();
  }
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

function expectPage(
  body: unknown,
  opts: { maxItems: number; minTotal: number; offset: number; limit: number },
) {
  const page = body as {
    items: unknown[];
    total: number;
    offset: number;
    limit: number;
  };
  expect(Array.isArray(page.items)).toBe(true);
  expect(page.items.length).toBeLessThanOrEqual(opts.maxItems);
  expect(page.total).toBeGreaterThanOrEqual(opts.minTotal);
  expect(page.offset).toBe(opts.offset);
  expect(page.limit).toBe(opts.limit);
  return page;
}

describe('c68 paginated list envelope', () => {
  it('GET messages returns PaginatedSchema with real total', async () => {
    const { status, body } = await get(
      `/v2/notebooks/${notebookId}/sessions/${sessionId}/messages?offset=0&limit=2`,
    );
    expect(status).toBe(200);
    const page = expectPage(body, { maxItems: 2, minTotal: 5, offset: 0, limit: 2 });
    expect(page.total).toBe(5);
    expect(page.items).toHaveLength(2);
  });

  it('GET sessions returns PaginatedSchema', async () => {
    const { status, body } = await get(`/v2/notebooks/${notebookId}/sessions?offset=0&limit=3`);
    expect(status).toBe(200);
    expectPage(body, { maxItems: 3, minTotal: 6, offset: 0, limit: 3 });
  });

  it('GET sources returns PaginatedSchema', async () => {
    const { status, body } = await get(`/v2/notebooks/${notebookId}/sources?offset=1&limit=2`);
    expect(status).toBe(200);
    const page = expectPage(body, { maxItems: 2, minTotal: 5, offset: 1, limit: 2 });
    expect(page.items).toHaveLength(2);
  });

  it('GET nested outputs returns PaginatedSchema', async () => {
    const { status, body } = await get(`/v2/notebooks/${notebookId}/outputs?offset=0&limit=2`);
    expect(status).toBe(200);
    expectPage(body, { maxItems: 2, minTotal: 5, offset: 0, limit: 2 });
  });

  it('GET nested studio slides returns PaginatedSchema', async () => {
    const { status, body } = await get(
      `/v2/notebooks/${notebookId}/studio/slides?offset=0&limit=2`,
    );
    expect(status).toBe(200);
    expectPage(body, { maxItems: 2, minTotal: 5, offset: 0, limit: 2 });
  });
});
