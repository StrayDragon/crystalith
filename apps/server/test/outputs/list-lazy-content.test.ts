import { describe, expect, it, beforeAll, afterAll } from 'bun:test';

import { eq } from 'drizzle-orm';

import { db } from '../../src/db/index.ts';
import { notebooks, outputs } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';

describe('c72 output list omits full content', () => {
  let app: ReturnType<typeof createApp>;
  let notebookId: number;
  let outputId: number;

  beforeAll(() => {
    app = createApp();
    const nb = db()
      .insert(notebooks)
      .values({ name: `c72-list-${Date.now()}` })
      .returning()
      .get();
    notebookId = nb.id;

    const bigBody = 'X'.repeat(4000);
    const row = db()
      .insert(outputs)
      .values({
        notebookId,
        type: 'BRIEFING',
        prompt: 'list-preview-prompt',
        chunkIds: [1, 2],
        content: {
          title: 'Big Report Title',
          summary: bigBody,
          markdown: bigBody,
          sections: [{ heading: 'A', body: bigBody }],
        },
      })
      .returning()
      .get();
    outputId = row.id;
  });

  afterAll(() => {
    db().delete(outputs).where(eq(outputs.id, outputId)).run();
    db().delete(notebooks).where(eq(notebooks.id, notebookId)).run();
  });

  it('list items have title/preview but no content body', async () => {
    const res = await app.handle(
      new Request(`http://localhost/v2/notebooks/${notebookId}/outputs?offset=0&limit=20`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<Record<string, unknown>>;
      total: number;
    };
    expect(body.total).toBeGreaterThanOrEqual(1);
    const item = body.items.find((row) => row.id === outputId);
    expect(item).toBeDefined();
    expect(item!.title).toBe('Big Report Title');
    expect(typeof item!.preview).toBe('string');
    expect(String(item!.preview).length).toBeLessThan(400);
    expect(item!.content).toBeUndefined();
  });

  it('detail returns full content', async () => {
    const res = await app.handle(
      new Request(`http://localhost/v2/notebooks/${notebookId}/outputs/${outputId}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(outputId);
    expect(body.content).toBeDefined();
    const content = body.content as Record<string, unknown>;
    expect(content.title).toBe('Big Report Title');
    expect(String(content.summary).length).toBe(4000);
  });
});
