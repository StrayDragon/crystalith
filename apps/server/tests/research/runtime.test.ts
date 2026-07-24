// Deep Research runtime (c76) — create/validation/status/prune/convert tests.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { eq } from 'drizzle-orm';

// Must mock before createApp pulls research service → searchWeb / ai.
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

import {
  getOrm,
  installAiMock,
  seedChatModel,
  setupIntegrationEnv,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

installAiMock({ text: 'mocked research chat' });
seedChatModel();

import { notebooks, outputs, researchRuns, sources } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';

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

describe('research runtime', () => {
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
      evidences: unknown[];
    };
    expect(run.report?.title).toContain('notebook only topic');
    expect(run.report?.citations).toBeDefined();
    expect(Array.isArray(run.evidences)).toBe(true);
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

  it('rejects prune on protected root with INVALID_REQUEST', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'protect root prune',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: number };
    await waitForStatus(created.id, ['awaiting_confirm', 'running', 'completed']);

    getOrm()
      .update(researchRuns)
      .set({
        graph: {
          nodes: [
            { id: 'node_root_1', title: 'Q', conclusionStatus: 'partial' },
            { id: 'branch_a', title: 'A', conclusionStatus: 'partial' },
          ],
          edges: [{ id: 'e1', source: 'node_root_1', target: 'branch_a', kind: 'decompose' }],
        },
        status: 'awaiting_confirm',
        confirmKind: 'budget',
      })
      .where(eq(researchRuns.id, created.id))
      .run();

    const prune = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/research/${created.id}/nodes/node_root_1/prune`,
        { method: 'POST' },
      ),
    );
    expect(prune.status).toBe(400);
    const body = (await prune.json()) as { errorCode?: string };
    expect(body.errorCode).toBe('INVALID_REQUEST');
  });

  it('prune keeps merge edges into conclusion (failed contribution)', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'merge retain prune',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: number };
    await waitForStatus(created.id, 'awaiting_confirm');

    getOrm()
      .update(researchRuns)
      .set({
        graph: {
          nodes: [
            { id: 'node_root_1', title: 'Q', conclusionStatus: 'partial' },
            { id: 'branch_a', title: 'A', conclusionStatus: 'partial' },
            { id: 'node_conclusion_1', title: '结论', conclusionStatus: 'pending' },
          ],
          edges: [
            { id: 'e1', source: 'node_root_1', target: 'branch_a', kind: 'decompose' },
            { id: 'm1', source: 'branch_a', target: 'node_conclusion_1', kind: 'merge' },
          ],
        },
        status: 'awaiting_confirm',
        confirmKind: 'budget',
      })
      .where(eq(researchRuns.id, created.id))
      .run();

    const prune = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/research/${created.id}/nodes/branch_a/prune`,
        { method: 'POST' },
      ),
    );
    expect(prune.status).toBe(200);
    const pruned = (await prune.json()) as {
      nodes: Array<{ id: string; conclusionStatus: string }>;
      edges: Array<{ id: string; kind: string }>;
    };
    expect(pruned.nodes.find((n) => n.id === 'branch_a')?.conclusionStatus).toBe('pruned');
    expect(pruned.nodes.find((n) => n.id === 'node_conclusion_1')?.conclusionStatus).not.toBe(
      'pruned',
    );
    expect(pruned.edges.some((e) => e.id === 'm1' && e.kind === 'merge')).toBe(true);
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

  it('lists runs scoped to notebook as summaries without graph', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research?offset=0&limit=50`),
    );
    expect(res.status).toBe(200);
    const page = (await res.json()) as {
      items: Array<Record<string, unknown>>;
      total: number;
    };
    expect(page.total).toBeGreaterThan(0);
    expect(page.items.length).toBeGreaterThan(0);
    const first = page.items[0]!;
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('topic');
    expect(first).toHaveProperty('status');
    expect(first).not.toHaveProperty('nodes');
    expect(first).not.toHaveProperty('edges');
    expect(first).not.toHaveProperty('report');
  });

  it('filters list by status query', async () => {
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'list status filter',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: number };
    await waitForStatus(created.id, ['awaiting_confirm', 'completed', 'running', 'failed']);

    const filtered = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/research?offset=0&limit=50&status=completed,cancelled`,
      ),
    );
    expect(filtered.status).toBe(200);
    const page = (await filtered.json()) as {
      items: Array<{ id: number; status: string }>;
    };
    for (const item of page.items) {
      expect(['completed', 'cancelled']).toContain(item.status);
    }
  });

  it('creates web-only run when topic-only body omits channel flags', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: 'topic only defaults' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      useNotebookSources: boolean;
      allowWeb: boolean;
    };
    expect(body.useNotebookSources).toBe(false);
    expect(body.allowWeb).toBe(true);
  });

  it('seeds single-sink DAG with question + conclusion roles', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'seed single sink',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: number };
    await waitForStatus(created.id, ['awaiting_confirm', 'completed', 'running']);

    const get = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
    );
    const run = (await get.json()) as {
      nodes: Array<{ id: string; role?: string }>;
    };
    const questions = run.nodes.filter(
      (n) => n.role === 'question' || n.id.startsWith('node_root'),
    );
    const conclusions = run.nodes.filter(
      (n) => n.role === 'conclusion' || n.id.startsWith('node_conclusion'),
    );
    expect(questions).toHaveLength(1);
    expect(conclusions).toHaveLength(1);
    expect(questions[0]?.role).toBe('question');
    expect(conclusions[0]?.role).toBe('conclusion');
  });

  it('approve_branch creates research node with fork + merge into conclusion', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'fork merge topic',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    const created = (await res.json()) as { id: number };
    await waitForStatus(created.id, 'awaiting_confirm');

    getOrm()
      .update(researchRuns)
      .set({
        graph: {
          nodes: [
            {
              id: 'node_root_1',
              role: 'question',
              title: 'Q',
              conclusionStatus: 'partial',
            },
            {
              id: 'node_conclusion_1',
              role: 'conclusion',
              title: '结论',
              conclusionStatus: 'pending',
            },
            { id: 'branch_a', role: 'research', title: 'A', conclusionStatus: 'partial' },
          ],
          edges: [
            { id: 'e1', source: 'node_root_1', target: 'branch_a', kind: 'decompose' },
            { id: 'm0', source: 'branch_a', target: 'node_conclusion_1', kind: 'merge' },
          ],
        },
        status: 'awaiting_confirm',
        confirmKind: 'expand_branch',
        confirmBranchNodeId: 'branch_a',
      })
      .where(eq(researchRuns.id, created.id))
      .run();

    const confirm = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'approve_branch', branchNodeId: 'branch_a' }),
      }),
    );
    expect(confirm.status).toBe(200);
    const run = (await confirm.json()) as {
      status: string;
      nodes: Array<{
        id: string;
        role?: string;
        evidenceIds?: string[];
        summary?: string;
      }>;
      edges: Array<{ source: string; target: string; kind: string }>;
    };
    expect(run.status).toBe('completed');
    const newResearch = run.nodes.filter((n) => n.role === 'research' && n.id !== 'branch_a');
    expect(newResearch.length).toBeGreaterThanOrEqual(1);
    const childId = newResearch[0]!.id;
    expect(
      run.edges.some((e) => e.source === 'branch_a' && e.target === childId && e.kind === 'fork'),
    ).toBe(true);
    expect(
      run.edges.some(
        (e) => e.source === childId && e.target === 'node_conclusion_1' && e.kind === 'merge',
      ),
    ).toBe(true);
    const child = run.nodes.find((n) => n.id === childId)!;
    expect((child.evidenceIds?.length ?? 0) > 0 || child.summary?.includes('已收集')).toBe(true);
  });

  it('PATCH updates research node query; rejects pruned and protected', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'patch node topic',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    const created = (await res.json()) as { id: number };
    await waitForStatus(created.id, 'awaiting_confirm');

    getOrm()
      .update(researchRuns)
      .set({
        graph: {
          nodes: [
            {
              id: 'node_root_1',
              role: 'question',
              title: 'Q',
              conclusionStatus: 'partial',
            },
            {
              id: 'node_conclusion_1',
              role: 'conclusion',
              title: '结论',
              conclusionStatus: 'pending',
            },
            {
              id: 'branch_a',
              role: 'research',
              title: 'A',
              query: 'old',
              conclusionStatus: 'partial',
            },
            {
              id: 'branch_pruned',
              role: 'research',
              title: 'P',
              conclusionStatus: 'pruned',
            },
          ],
          edges: [],
        },
        status: 'awaiting_confirm',
        confirmKind: 'budget',
      })
      .where(eq(researchRuns.id, created.id))
      .run();

    const ok = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/nodes/branch_a`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'new query' }),
      }),
    );
    expect(ok.status).toBe(200);
    const patched = (await ok.json()) as {
      nodes: Array<{ id: string; query?: string }>;
    };
    expect(patched.nodes.find((n) => n.id === 'branch_a')?.query).toBe('new query');

    const rejectProtected = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/nodes/node_root_1`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'nope' }),
      }),
    );
    expect(rejectProtected.status).toBe(400);

    const rejectPruned = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/nodes/branch_pruned`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'nope' }),
      }),
    );
    expect(rejectPruned.status).toBe(400);

    const empty = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/nodes/branch_a`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(empty.status).toBe(422);
  });

  it('cancel aborts running work-unit toward cancelled', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'cancel abort topic',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    const created = (await res.json()) as { id: number };
    // Cancel while still live (queued/running/awaiting)
    await Bun.sleep(5);
    const cancel = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/cancel`, {
        method: 'POST',
      }),
    );
    expect(cancel.status).toBe(200);
    const status = await waitForStatus(created.id, ['cancelled', 'completed', 'awaiting_confirm']);
    // If already past cancel window into awaiting/completed, still ok; prefer cancelled
    if (status === 'cancelled') {
      const get = await app.handle(
        new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
      );
      const run = (await get.json()) as { status: string };
      expect(run.status).toBe('cancelled');
    }
  });

  it('node chat streams proposals without auto-pruning the graph', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'chat no prune',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    const created = (await res.json()) as { id: number };
    await waitForStatus(created.id, 'awaiting_confirm');

    getOrm()
      .update(researchRuns)
      .set({
        graph: {
          nodes: [
            {
              id: 'node_root_1',
              role: 'question',
              title: 'Q',
              conclusionStatus: 'partial',
            },
            {
              id: 'node_conclusion_1',
              role: 'conclusion',
              title: '结论',
              conclusionStatus: 'pending',
            },
            {
              id: 'branch_a',
              role: 'research',
              title: 'A',
              conclusionStatus: 'partial',
            },
          ],
          edges: [],
        },
        status: 'awaiting_confirm',
        confirmKind: 'budget',
        llmActivity: null,
      })
      .where(eq(researchRuns.id, created.id))
      .run();

    const chat = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/nodes/branch_a/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: '请剪枝这个节点 prune' }),
      }),
    );
    expect(chat.status).toBe(200);
    expect(chat.headers.get('content-type')).toContain('text/event-stream');
    const text = await chat.text();
    expect(text).toContain('event: log');
    expect(text).toContain('connected');
    expect(text).toContain('event: chunk');
    expect(text).toContain('agent:mocked research chat');
    expect(text).toContain('event: proposal');
    expect(text).toContain('prune_node');
    expect(text).toContain('event: done');

    const get = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
    );
    const run = (await get.json()) as {
      nodes: Array<{ id: string; conclusionStatus: string }>;
      llmActivity: string | null;
      activeNodeId: string | null;
    };
    expect(run.nodes.find((n) => n.id === 'branch_a')?.conclusionStatus).toBe('partial');
    expect(run.llmActivity).toBeNull();
    expect(run.activeNodeId).toBeNull();
  });

  it('progress afterSeq returns ledger gap-fill; revision create/restore works', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'progress revision topic',
          useNotebookSources: true,
          allowWeb: false,
          sourceIds: [sourceId],
          depth: 'shallow',
        }),
      }),
    );
    const created = (await res.json()) as { id: number };
    await waitForStatus(created.id, 'completed');

    const progressAll = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/progress?limit=50`),
    );
    expect(progressAll.status).toBe(200);
    const all = (await progressAll.json()) as {
      items: Array<{ seq: number; kind: string }>;
      nextAfterSeq?: number;
    };
    expect(all.items.length).toBeGreaterThan(0);
    expect(all.items.some((e) => e.kind === 'run_completed' || e.kind === 'run_running')).toBe(
      true,
    );

    const mid = all.items[0]!.seq;
    const progressGap = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/research/${created.id}/progress?afterSeq=${mid}&limit=50`,
      ),
    );
    const gap = (await progressGap.json()) as { items: Array<{ seq: number }> };
    expect(gap.items.every((e) => e.seq > mid)).toBe(true);

    const createRev = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: 'manual save', from: 'canonical' }),
      }),
    );
    expect(createRev.status).toBe(201);
    const rev = (await createRev.json()) as { id: string; label: string };
    expect(rev.label).toBe('manual save');

    // Mutate graph then restore
    getOrm()
      .update(researchRuns)
      .set({
        graph: {
          nodes: [
            {
              id: 'node_root_mutated',
              role: 'question',
              title: 'mutated',
              conclusionStatus: 'clear',
            },
          ],
          edges: [],
        },
      })
      .where(eq(researchRuns.id, created.id))
      .run();

    const restore = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/research/${created.id}/revisions/${rev.id}/restore`,
        { method: 'POST' },
      ),
    );
    expect(restore.status).toBe(200);
    const restored = (await restore.json()) as {
      nodes: Array<{ id: string; title: string }>;
    };
    expect(restored.nodes.some((n) => n.id === 'node_root_mutated')).toBe(false);
    expect(restored.nodes.length).toBeGreaterThan(0);

    const list = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/revisions`),
    );
    const listed = (await list.json()) as { items: Array<{ id: string }> };
    expect(listed.items.some((r) => r.id === rev.id)).toBe(true);
  });
});
