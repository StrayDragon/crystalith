// Deep Research runtime (c76) — create/validation/status/prune/convert tests.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { eq } from 'drizzle-orm';

// Must mock before createApp pulls research service → searchWeb.
mock.module('../../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => [
    {
      title: 'Mock Web Result',
      url: 'https://example.com/mock',
      snippet: 'Mock snippet about the topic.',
      source: 'mock',
    },
  ],
  webSearchTool: () => ({}),
}));

import { notebooks, outputs, sources } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;
let sourceId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'research-c76-nb' }).returning().get().id;
  sourceId = getOrm()
    .insert(sources)
    .values({
      notebookId,
      filename: 'seed.md',
      mimeType: 'text/markdown',
      parserType: 'text',
      status: 'ready',
    })
    .returning()
    .get().id;
});

afterAll(teardownIntegrationEnv);

async function waitForStatus(
  runId: number,
  wanted: string | string[],
  timeoutMs = 3000,
): Promise<string> {
  const targets = Array.isArray(wanted) ? wanted : [wanted];
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${runId}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    last = body.status;
    if (targets.includes(body.status)) return body.status;
    await Bun.sleep(20);
  }
  throw new Error(`Timed out waiting for status ${targets.join('|')}; last=${last}`);
}

describe('research runtime (c76)', () => {
  it('rejects create when both toggles are false', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'x',
          useNotebookSources: false,
          allowWeb: false,
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errorCode?: string };
    expect(body.errorCode).toBe('INVALID_REQUEST');
  });

  it('rejects create when useNotebookSources without sourceIds', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'x',
          useNotebookSources: true,
          allowWeb: true,
          sourceIds: [],
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errorCode?: string };
    expect(body.errorCode).toBe('INVALID_REQUEST');
  });

  it('creates run with default medium budget and returns queued', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'quantum error correction',
          useNotebookSources: false,
          allowWeb: true,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: number;
      status: string;
      depth: string;
      maxSearches: number;
      maxNodes: number;
    };
    expect(body.id).toBeGreaterThan(0);
    expect(['queued', 'running', 'awaiting_confirm', 'completed']).toContain(body.status);
    expect(body.depth).toBe('medium');
    expect(body.maxSearches).toBe(20);
    expect(body.maxNodes).toBe(30);
  });

  it('POST unknown notebook returns 404', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/999999/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'x',
          useNotebookSources: false,
          allowWeb: true,
        }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it('notebook-only run reaches completed with report', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'notebook only topic',
          useNotebookSources: true,
          allowWeb: false,
          sourceIds: [sourceId],
          depth: 'shallow',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: number };
    const status = await waitForStatus(created.id, 'completed');
    expect(status).toBe('completed');

    const get = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
    );
    const run = (await get.json()) as {
      report: { title: string; citations: Record<string, unknown> } | null;
      nodes: unknown[];
    };
    expect(run.report?.title).toContain('notebook only topic');
    expect(run.report?.citations).toBeDefined();
  });

  it('web run pauses at awaiting_confirm; finish_report completes', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'web budget topic',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: number };
    await waitForStatus(created.id, 'awaiting_confirm');

    const confirm = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'finish_report' }),
      }),
    );
    expect(confirm.status).toBe(200);
    await waitForStatus(created.id, 'completed');
  });

  it('prune on completed returns RESEARCH_INVALID_STATE', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'prune invalid',
          useNotebookSources: true,
          allowWeb: false,
          sourceIds: [sourceId],
        }),
      }),
    );
    const created = (await res.json()) as { id: number };
    await waitForStatus(created.id, 'completed');
    const get = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
    );
    const run = (await get.json()) as { nodes: Array<{ id: string }> };
    const nodeId = run.nodes[0]?.id ?? 'missing';

    const prune = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/research/${created.id}/nodes/${nodeId}/prune`,
        { method: 'POST' },
      ),
    );
    expect(prune.status).toBe(409);
    const body = (await prune.json()) as { errorCode?: string };
    expect(body.errorCode).toBe('RESEARCH_INVALID_STATE');
  });

  it('convertToNote writes PARAGRAPH with GFM footnotes', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'footnote topic',
          useNotebookSources: false,
          allowWeb: true,
        }),
      }),
    );
    const created = (await res.json()) as { id: number };
    await waitForStatus(created.id, 'awaiting_confirm');
    await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'finish_report' }),
      }),
    );
    await waitForStatus(created.id, 'completed');

    const convert = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/convert-to-note`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ artifact: { kind: 'report' } }),
      }),
    );
    expect(convert.status).toBe(201);
    const out = (await convert.json()) as { outputId: number; type: string };
    expect(out.type).toBe('PARAGRAPH');
    const row = getOrm().select().from(outputs).where(eq(outputs.id, out.outputId)).get();
    expect(row?.type).toBe('PARAGRAPH');
    const content = row?.content as { text?: string };
    expect(content.text).toContain('[^');
    expect(content.text).toMatch(/\[\^\d+\]:/);
  });

  it('convertToSource creates ready source with chunks', async () => {
    const { stubEmbedding } = await import('../helpers/integration.ts');
    await stubEmbedding();

    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'convert source topic',
          useNotebookSources: true,
          allowWeb: false,
          sourceIds: [sourceId],
        }),
      }),
    );
    const created = (await res.json()) as { id: number };
    await waitForStatus(created.id, 'completed');

    const convert = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/convert-to-source`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ artifact: { kind: 'report' } }),
      }),
    );
    expect(convert.status).toBe(201);
    const body = (await convert.json()) as {
      sourceId: number;
      filename: string;
      chunkCount: number;
    };
    expect(body.sourceId).toBeGreaterThan(0);
    expect(body.chunkCount).toBeGreaterThan(0);
    const src = getOrm().select().from(sources).where(eq(sources.id, body.sourceId)).get();
    expect(src?.status).toBe('ready');
    expect(src?.metadata).toMatchObject({ source: 'research_conversion' });
  });

  it('lists runs scoped to notebook', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research?offset=0&limit=50`),
    );
    expect(res.status).toBe(200);
    const page = (await res.json()) as { items: unknown[]; total: number };
    expect(page.total).toBeGreaterThan(0);
    expect(page.items.length).toBeGreaterThan(0);
  });
});
