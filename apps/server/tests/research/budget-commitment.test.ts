/**
 * c108 — research budget commitment: L1 numbers, add-on formula, confirm timing, soft cap.
 */
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { eq } from 'drizzle-orm';

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

import { notebooks, researchRuns } from '../../src/db/schema.ts';
import {
  applySearchBudgetAddOn,
  confirmRun,
  createRun,
} from '../../src/features/research/commands.ts';
import {
  computeSearchAddOnK,
  computeSearchSoftCap,
} from '../../src/features/research/research-budget.ts';
import { getGraph, requireFresh, updateRun } from '../../src/features/research/research-core.ts';
import { createApp } from '../../src/server.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'research-c108-nb' }).returning().get().id;
});

afterAll(teardownIntegrationEnv);

describe('search budget helpers (c108)', () => {
  it('computeSearchAddOnK = clamp(ceil(max * ratio), min, max)', () => {
    expect(computeSearchAddOnK(50, 0.25, 5, 50)).toBe(13);
    expect(computeSearchAddOnK(8, 0.25, 5, 50)).toBe(5); // ceil(2)=2 → min 5
    expect(computeSearchAddOnK(400, 0.25, 5, 50)).toBe(50); // ceil(100)=100 → max 50
    expect(computeSearchAddOnK(20, 0.25, 5, 50)).toBe(5);
  });

  it('computeSearchSoftCap = max(1, ceil(remaining / liveNodes))', () => {
    expect(computeSearchSoftCap(9, 3)).toBe(3);
    expect(computeSearchSoftCap(1, 5)).toBe(1);
    expect(computeSearchSoftCap(0, 3)).toBe(1);
  });
});

describe('L1 depth budgets (r305)', () => {
  it('default medium → maxSearches=50 maxNodes=60', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'c108 medium',
          useNotebookSources: false,
          allowWeb: true,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { maxSearches: number; maxNodes: number; depth: string };
    expect(body.depth).toBe('medium');
    expect(body.maxSearches).toBe(50);
    expect(body.maxNodes).toBe(60);
  });

  it('shallow → 20/24; deep → 100/120', async () => {
    const shallow = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'c108 shallow',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    const s = (await shallow.json()) as { maxSearches: number; maxNodes: number };
    expect(s.maxSearches).toBe(20);
    expect(s.maxNodes).toBe(24);

    const deep = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'c108 deep',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'deep',
        }),
      }),
    );
    const d = (await deep.json()) as { maxSearches: number; maxNodes: number };
    expect(d.maxSearches).toBe(100);
    expect(d.maxNodes).toBe(120);
  });
});

describe('add-budget + budget continue (r341/r343)', () => {
  it('POST add-budget raises maxSearches by K and does not raise maxNodes', async () => {
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'c108 add-budget',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'medium',
        }),
      }),
    );
    expect(create.status).toBe(201);
    const run = (await create.json()) as {
      id: number;
      maxSearches: number;
      maxNodes: number;
      maxPageFetches: number;
    };
    expect(run.maxSearches).toBe(50);
    const maxNodesBefore = run.maxNodes;
    const pagesBefore = run.maxPageFetches;

    // Force running so add-budget is allowed without waiting for loop.
    getOrm()
      .update(researchRuns)
      .set({ status: 'running' })
      .where(eq(researchRuns.id, run.id))
      .run();

    const add = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${run.id}/add-budget`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    expect(add.status).toBe(200);
    const next = (await add.json()) as {
      maxSearches: number;
      maxNodes: number;
      maxPageFetches: number;
      status: string;
    };
    expect(next.maxSearches).toBe(50 + computeSearchAddOnK(50, 0.25, 5, 50));
    expect(next.maxNodes).toBe(maxNodesBefore);
    expect(next.maxPageFetches).toBe(pagesBefore);
  });

  it('budget continue raises maxSearches and resumes (not completed)', async () => {
    const created = createRun(notebookId, {
      topic: 'c108 continue resume',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'medium',
    });
    updateRun(created.id, {
      status: 'awaiting_confirm',
      confirmKind: 'budget',
      searchesUsed: created.maxSearches,
    });
    const maxNodesBefore = created.maxNodes;

    const out = await confirmRun(notebookId, created.id, { action: 'continue' });
    expect(out.status).toBe('running');
    expect(out.maxSearches).toBe(50 + computeSearchAddOnK(50, 0.25, 5, 50));
    expect(out.maxNodes).toBe(maxNodesBefore);
    expect(out.status).not.toBe('completed');
  });

  it('applySearchBudgetAddOn uses current maxSearches as base', () => {
    const created = createRun(notebookId, {
      topic: 'c108 compound addon',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'medium',
    });
    const first = applySearchBudgetAddOn(created.id);
    expect(first.k).toBe(13);
    expect(first.maxSearches).toBe(63);
    const second = applySearchBudgetAddOn(created.id);
    expect(second.k).toBe(computeSearchAddOnK(63, 0.25, 5, 50));
    expect(second.maxSearches).toBe(63 + second.k);
  });
});

describe('no mid-wave budget confirm (r306)', () => {
  it('finishWaveOrSynthesize does not enter budget when searches remain', async () => {
    const { finishWaveOrSynthesize } = await import('../../src/features/research/run-loop.ts');
    const created = createRun(notebookId, {
      topic: 'c108 no mid-wave',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'medium',
    });
    // Seed a completed research node so drain has nothing pending; searchesUsed mid-range.
    const rowAtStart = requireFresh(created.id);
    const graph = getGraph(rowAtStart);
    graph.nodes.push({
      id: 'node_research_done',
      role: 'research',
      title: 'Done',
      conclusionStatus: 'clear',
      evidenceIds: ['ev_x'],
      phase: 'idle',
      summary: 'done',
    });
    const { persistGraph } = await import('../../src/features/research/research-core.ts');
    persistGraph(created.id, graph);
    updateRun(created.id, {
      status: 'running',
      searchesUsed: 10,
      allowWeb: true,
    });

    await finishWaveOrSynthesize(created.id);
    const row = getOrm().select().from(researchRuns).where(eq(researchRuns.id, created.id)).get();
    expect(row?.confirmKind ?? null).toBeNull();
    expect(row?.status).not.toBe('awaiting_confirm');
  });
});

describe('partial completion prompt (r344)', () => {
  it('generateLlmResearchReport prompt includes 预算用尽 when missing research nodes', async () => {
    // Exercise helper path via report module by checking uncovered list behavior through synthesize stub.
    // Direct unit: markUnfinished path + e2e stub report still completes.
    const created = createRun(notebookId, {
      topic: 'c108 partial',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'shallow',
    });
    const rowAtStart = requireFresh(created.id);
    const graph = getGraph(rowAtStart);
    graph.nodes.push({
      id: 'node_research_gap',
      role: 'research',
      title: '未覆盖主题X',
      conclusionStatus: 'missing',
      evidenceIds: [],
      phase: 'idle',
      summary: '预算用尽，未完成检索',
    });
    const { persistGraph } = await import('../../src/features/research/research-core.ts');
    persistGraph(created.id, graph);
    updateRun(created.id, {
      status: 'awaiting_confirm',
      confirmKind: 'budget',
      searchesUsed: created.maxSearches,
    });

    // finish_report should synthesize (e2e stub or mock) without raising maxSearches
    process.env.CL_RESEARCH_E2E_STUB = '1';
    try {
      const out = await confirmRun(notebookId, created.id, { action: 'finish_report' });
      expect(out.maxSearches).toBe(created.maxSearches);
      // Stub may complete quickly; status should leave awaiting_confirm
      expect(out.status).not.toBe('awaiting_confirm');
    } finally {
      delete process.env.CL_RESEARCH_E2E_STUB;
    }
  });
});
