// Manual PARAGRAPH note: POST …/outputs with content, no sourceIds / no LLM.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { eq } from 'drizzle-orm';

import { notebooks, outputs } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'manual-note-nb' }).returning().get().id;
});

afterAll(teardownIntegrationEnv);

describe('manual PARAGRAPH note create', () => {
  it('creates a markdown note without sourceIds', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/outputs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'PARAGRAPH',
          prompt: '我的笔记',
          content: { title: '我的笔记', text: '# Hello\n\nmarkdown body' },
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: number;
      type: string;
      content: { title?: string; text?: string };
    };
    expect(body.type).toBe('PARAGRAPH');
    expect(body.content.text).toContain('markdown body');
    expect(body.content.title).toBe('我的笔记');

    const row = getOrm().select().from(outputs).where(eq(outputs.id, body.id)).get();
    expect(row?.type).toBe('PARAGRAPH');
  });

  it('rejects empty PARAGRAPH text', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/outputs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'PARAGRAPH',
          content: { title: 'x', text: '   ' },
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('still requires sourceIds for tool types without content', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/outputs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'FAQ', prompt: 'summarize' }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
