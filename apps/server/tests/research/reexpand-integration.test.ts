/**
 * c104 / r333–r334: request-reexpand confirm gate + approve/skip/planner failure.
 */
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

mock.module('../../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => [
    {
      title: 'Mock Web Result',
      url: 'https://example.com/mock',
      snippet: 'Mock snippet',
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

installAiMock({
  text: 'mocked',
  object: () => ({
    branches: [
      { title: '支路A', query: 'query a', edgeKind: 'decompose' },
      { title: '支路B', query: 'query b', edgeKind: 'decompose' },
    ],
  }),
});
seedChatModel();

import { eq } from 'drizzle-orm';

import { notebooks, researchRuns } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'research-c104-nb' }).returning().get().id;
});

afterAll(teardownIntegrationEnv);

async function waitForStatus(runId: number, wanted: string[], timeoutMs = 4000): Promise<string> {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${runId}`),
    );
    const body = (await res.json()) as { status: string };
    last = body.status;
    if (wanted.includes(body.status)) return body.status;
    await Bun.sleep(20);
  }
  throw new Error(`timeout status; last=${last}`);
}

async function createAndAwaitConfirm(): Promise<{ id: number; researchCount: number }> {
  const create = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        topic: 'c104 reexpand topic',
        useNotebookSources: false,
        allowWeb: true,
        depth: 'shallow',
      }),
    }),
  );
  expect(create.status).toBe(201);
  const created = (await create.json()) as { id: number };
  // c108: open-run commitment no longer mid-wave budget-pauses; wait until kernel settles.
  await waitForStatus(created.id, ['awaiting_confirm', 'completed']);
  getOrm()
    .update(researchRuns)
    .set({ status: 'awaiting_confirm', confirmKind: 'budget', llmActivity: null })
    .where(eq(researchRuns.id, created.id))
    .run();
  await Bun.sleep(20);
  const get = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
  );
  const run = (await get.json()) as {
    id: number;
    status: string;
    nodes: Array<{ role?: string }>;
  };
  expect(run.status).toBe('awaiting_confirm');
  return {
    id: run.id,
    researchCount: run.nodes.filter((n) => n.role === 'research').length,
  };
}

describe('research request-reexpand (c104)', () => {
  it('request-reexpand → awaiting_confirm + confirmKind=reexpand', async () => {
    const { id } = await createAndAwaitConfirm();
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}/request-reexpand`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hint: '加深对比' }),
      }),
    );
    expect(res.status).toBe(200);
    const run = (await res.json()) as {
      status: string;
      confirmKind: string | null;
    };
    expect(run.status).toBe('awaiting_confirm');
    expect(run.confirmKind).toBe('reexpand');
  });

  it('request-reexpand from running cooperatively pauses to reexpand confirm', async () => {
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'c104 running reexpand',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: number };

    // Prefer catching live running; stub may already leave the window.
    let caughtRunning = false;
    try {
      await waitForStatus(created.id, ['running'], 1500);
      caughtRunning = true;
    } catch {
      /* fall through — force running to exercise the cooperative-pause branch */
    }
    if (!caughtRunning) {
      getOrm()
        .update(researchRuns)
        .set({ status: 'running', confirmKind: null, confirmBranchNodeId: null })
        .where(eq(researchRuns.id, created.id))
        .run();
    }

    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/request-reexpand`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hint: 'running 再扩展' }),
      }),
    );
    expect(res.status).toBe(200);
    const run = (await res.json()) as {
      status: string;
      confirmKind: string | null;
      llmActivity?: string | null;
    };
    expect(run.status).toBe('awaiting_confirm');
    expect(run.confirmKind).toBe('reexpand');
    expect(run.llmActivity ?? null).toBeNull();
    // Cooperative abort MUST NOT finalize as cancelled
    await Bun.sleep(80);
    const get = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
    );
    const after = (await get.json()) as { status: string; confirmKind: string | null };
    expect(after.status).not.toBe('cancelled');
    expect(after.status).toBe('awaiting_confirm');
    expect(after.confirmKind).toBe('reexpand');
  });

  it('approve_reexpand adds research nodes', async () => {
    const { id, researchCount } = await createAndAwaitConfirm();
    await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}/request-reexpand`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    const confirm = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'approve_reexpand' }),
      }),
    );
    expect(confirm.status).toBe(200);
    await waitForStatus(id, ['awaiting_confirm', 'completed', 'failed'], 8000);
    const get = await app.handle(new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}`));
    const run = (await get.json()) as {
      nodes: Array<{ role?: string }>;
      edges: Array<{ kind: string }>;
    };
    const nextCount = run.nodes.filter((n) => n.role === 'research').length;
    expect(nextCount).toBeGreaterThan(researchCount);
    expect(run.edges.some((e) => e.kind === 'decompose' || e.kind === 'refine')).toBe(true);
    expect(run.edges.some((e) => e.kind === 'merge')).toBe(true);
  });

  it('skip_reexpand does not add research nodes', async () => {
    const { id, researchCount } = await createAndAwaitConfirm();
    await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}/request-reexpand`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    const confirm = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'skip_reexpand' }),
      }),
    );
    expect(confirm.status).toBe(200);
    const run = (await confirm.json()) as {
      status: string;
      nodes: Array<{ role?: string }>;
    };
    expect(run.nodes.filter((n) => n.role === 'research').length).toBe(researchCount);
    expect(['completed', 'awaiting_confirm', 'running']).toContain(run.status);
  });

  it('rejects request-reexpand on completed', async () => {
    const { id } = await createAndAwaitConfirm();
    // Force completed
    getOrm()
      .update(researchRuns)
      .set({ status: 'completed', confirmKind: null })
      .where(eq(researchRuns.id, id))
      .run();
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}/request-reexpand`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(409);
  });

  it('r333: no automatic second decompose without request-reexpand', async () => {
    const { id, researchCount } = await createAndAwaitConfirm();
    await Bun.sleep(80);
    const get = await app.handle(new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}`));
    const run = (await get.json()) as {
      status: string;
      confirmKind: string | null;
      nodes: Array<{ role?: string }>;
    };
    expect(run.status).toBe('awaiting_confirm');
    expect(run.confirmKind).not.toBe('reexpand');
    expect(run.nodes.filter((n) => n.role === 'research').length).toBe(researchCount);
  });

  it('reexpand with no room (empty plan) MUST NOT fake branches', async () => {
    const { id, researchCount } = await createAndAwaitConfirm();
    // Exhaust node budget so planner returns empty branches
    const row = getOrm().select().from(researchRuns).where(eq(researchRuns.id, id)).get()!;
    const graph = row.graph as { nodes: Array<{ conclusionStatus?: string }> };
    const occupied = graph.nodes.filter((n) => n.conclusionStatus !== 'pruned').length;
    getOrm().update(researchRuns).set({ maxNodes: occupied }).where(eq(researchRuns.id, id)).run();

    await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}/request-reexpand`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    const confirm = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'approve_reexpand' }),
      }),
    );
    expect(confirm.status).toBe(200);
    const run = (await confirm.json()) as {
      nodes: Array<{ role?: string }>;
    };
    expect(run.nodes.filter((n) => n.role === 'research').length).toBe(researchCount);
  });
});
