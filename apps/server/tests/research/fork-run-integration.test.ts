/**
 * c105 / r335: revision fork-run creates a new ResearchRun; source unchanged.
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

import { notebooks, researchEvidences, researchRuns } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'research-c105-nb' }).returning().get().id;
});

afterAll(teardownIntegrationEnv);

async function waitForStatus(runId: number, wanted: string[], timeoutMs = 8000): Promise<string> {
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

describe('research revision fork-run (c105)', () => {
  it('fork-creates-new-run-id + copies graph/report + remaps evidence; source unchanged', async () => {
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'c105 fork topic',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: number };
    await waitForStatus(created.id, ['completed', 'awaiting_confirm']);

    // Force a terminal completed run with known graph/report/evidence for deterministic fork asserts.
    const evId = 'ev_c105_src';
    getOrm()
      .insert(researchEvidences)
      .values({
        id: evId,
        runId: created.id,
        notebookId,
        kind: 'web',
        title: '证据标题',
        snippet: '证据片段',
        url: 'https://example.com/ev',
        collectedAtNodeId: 'n1',
      })
      .run();

    const graph = {
      nodes: [
        {
          id: 'n1',
          role: 'research' as const,
          title: '节点',
          conclusionStatus: 'partial' as const,
          evidenceIds: [evId],
        },
      ],
      edges: [],
    };
    const report = {
      title: '报告标题',
      sections: [
        {
          id: 's1',
          heading: '概述',
          blocks: [{ type: 'paragraph' as const, text: '正文', citeIds: [evId] }],
        },
      ],
      citations: {
        [evId]: { sourceName: '证据标题', snippet: '证据片段', url: 'https://example.com/ev' },
      },
    };

    getOrm()
      .update(researchRuns)
      .set({
        status: 'completed',
        graph,
        report,
        searchesUsed: 3,
        confirmKind: null,
        cancelRequested: false,
      })
      .where(eq(researchRuns.id, created.id))
      .run();

    const createRev = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: 'fork-me', from: 'canonical' }),
      }),
    );
    expect(createRev.status).toBe(201);
    const rev = (await createRev.json()) as { id: string };

    const beforeSource = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
    );
    const sourceBefore = (await beforeSource.json()) as {
      status: string;
      searchesUsed: number;
      nodes: Array<{ evidenceIds?: string[] }>;
      report: { title: string; citations: Record<string, unknown> };
    };
    const beforeRevs = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/revisions`),
    );
    const revListBefore = (await beforeRevs.json()) as { items: Array<{ id: string }> };

    const fork = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/research/${created.id}/revisions/${rev.id}/fork-run`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        },
      ),
    );
    expect(fork.status).toBe(201);
    const forked = (await fork.json()) as {
      id: number;
      status: string;
      topic: string;
      searchesUsed: number;
      nodes: Array<{ evidenceIds?: string[] }>;
      evidences: Array<{ id: string; title: string }>;
      report: {
        title: string;
        sections: Array<{ blocks: Array<{ citeIds: string[] }> }>;
        citations: Record<string, unknown>;
      } | null;
    };

    expect(forked.id).not.toBe(created.id);
    expect(forked.status).toBe('queued');
    expect(forked.topic).toBe('c105 fork topic');
    expect(forked.searchesUsed).toBe(0);
    expect(forked.report?.title).toBe('报告标题');
    expect(forked.nodes[0]?.evidenceIds?.[0]).toBeTruthy();
    expect(forked.nodes[0]?.evidenceIds?.[0]).not.toBe(evId);
    const newEvId = forked.nodes[0]!.evidenceIds![0]!;
    expect(forked.evidences.some((e) => e.id === newEvId && e.title === '证据标题')).toBe(true);
    expect(forked.report?.citations[newEvId]).toBeTruthy();
    expect(forked.report?.citations[evId]).toBeUndefined();
    expect(forked.report?.sections[0]?.blocks[0]?.citeIds).toEqual([newEvId]);

    // Source unchanged
    const afterSource = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
    );
    const sourceAfter = (await afterSource.json()) as typeof sourceBefore;
    expect(sourceAfter.status).toBe(sourceBefore.status);
    expect(sourceAfter.searchesUsed).toBe(sourceBefore.searchesUsed);
    expect(sourceAfter.nodes[0]?.evidenceIds).toEqual([evId]);
    expect(sourceAfter.report.citations[evId]).toBeTruthy();

    const afterRevs = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/revisions`),
    );
    const revListAfter = (await afterRevs.json()) as { items: Array<{ id: string }> };
    expect(revListAfter.items.map((r) => r.id).sort()).toEqual(
      revListBefore.items.map((r) => r.id).sort(),
    );
  });

  it('fork-default-no-schedule keeps queued; schedule:true starts kernel; POST schedule only for queued', async () => {
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'c105 schedule topic',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    const created = (await create.json()) as { id: number };
    await waitForStatus(created.id, ['completed', 'awaiting_confirm']);
    getOrm()
      .update(researchRuns)
      .set({
        status: 'completed',
        graph: {
          nodes: [
            {
              id: 'q',
              role: 'question',
              title: '主题',
              conclusionStatus: 'clear',
              evidenceIds: [],
            },
          ],
          edges: [],
        },
        report: { title: 't', sections: [], citations: {} },
        searchesUsed: 1,
      })
      .where(eq(researchRuns.id, created.id))
      .run();

    const createRev = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: 'sched', from: 'canonical' }),
      }),
    );
    const rev = (await createRev.json()) as { id: string };

    const forkQuiet = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/research/${created.id}/revisions/${rev.id}/fork-run`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ schedule: false }),
        },
      ),
    );
    const quiet = (await forkQuiet.json()) as { id: number; status: string };
    expect(quiet.status).toBe('queued');
    await Bun.sleep(50);
    const still = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${quiet.id}`),
    );
    expect(((await still.json()) as { status: string }).status).toBe('queued');

    const sched = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${quiet.id}/schedule`, {
        method: 'POST',
      }),
    );
    expect(sched.status).toBe(200);
    await waitForStatus(quiet.id, ['running', 'awaiting_confirm', 'completed', 'failed']);

    const rejectSched = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/schedule`, {
        method: 'POST',
      }),
    );
    expect(rejectSched.status).toBeGreaterThanOrEqual(400);
    const err = (await rejectSched.json()) as { errorCode?: string; code?: string };
    expect(err.errorCode ?? err.code).toBe('RESEARCH_INVALID_STATE');

    const forkHot = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/research/${created.id}/revisions/${rev.id}/fork-run`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ schedule: true }),
        },
      ),
    );
    expect(forkHot.status).toBe(201);
    const hot = (await forkHot.json()) as { id: number; status: string };
    expect(hot.status).toBe('queued');
    await waitForStatus(hot.id, ['running', 'awaiting_confirm', 'completed', 'failed']);
  });
});
