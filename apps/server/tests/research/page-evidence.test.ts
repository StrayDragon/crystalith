/**
 * c107 — page evidence budget, ingest upgrade, token truncate, create maxPageFetches.
 */
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { eq } from 'drizzle-orm';

mock.module('../../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => [],
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

import { countTokens, truncateToTokens } from '../../src/ai/tokenizer.ts';
import { notebooks, researchRuns } from '../../src/db/schema.ts';
import {
  computeMaxPageFetches,
  computePageSoftCap,
} from '../../src/features/research/research-budget.ts';
import {
  insertEvidence,
  listEvidences,
  upsertWebEvidenceContent,
} from '../../src/features/research/research-core.ts';
import { ingestWorkToolResult } from '../../src/features/research/run-loop.ts';
import { createApp } from '../../src/server.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'c107-page-ev' }).returning().get().id;
});

afterAll(teardownIntegrationEnv);

describe('research-budget helpers', () => {
  it('computeMaxPageFetches = max(1, ceil(maxSearches * pageRatio))', () => {
    expect(computeMaxPageFetches(20, 1.5)).toBe(30);
    expect(computeMaxPageFetches(8, 1.5)).toBe(12);
    expect(computeMaxPageFetches(1, 1.5)).toBe(2);
    expect(computeMaxPageFetches(1, 0.1)).toBe(1);
    expect(computeMaxPageFetches(0, 1.5)).toBe(1);
  });

  it('computePageSoftCap divides remaining pages across live nodes', () => {
    expect(computePageSoftCap(30, 3)).toBe(10);
    expect(computePageSoftCap(5, 3)).toBe(2);
    expect(computePageSoftCap(0, 3)).toBe(1);
    expect(computePageSoftCap(10, 0)).toBe(10);
  });
});

describe('ingest fetchPage same-URL upgrade + truncate', () => {
  it('upgrades existing web evidence content without new row; pagesDelta=1', () => {
    const run = getOrm()
      .insert(researchRuns)
      .values({
        notebookId,
        topic: 'c107 ingest',
        status: 'running',
        useNotebookSources: false,
        allowWeb: true,
        depth: 'shallow',
        maxSearches: 8,
        maxNodes: 12,
        searchesUsed: 0,
        maxPageFetches: 12,
        pagesUsed: 0,
        graph: { nodes: [], edges: [] },
      })
      .returning()
      .get();

    const snip = insertEvidence(run.id, notebookId, {
      kind: 'web',
      title: 'SERP title',
      snippet: 'short snippet',
      url: 'https://example.com/page',
      collectedAtNodeId: 'n1',
    });

    const ingested = ingestWorkToolResult(run.id, notebookId, 'n1', 'fetchPage', {
      ok: true,
      url: 'https://example.com/page',
      title: 'Full title',
      content: 'Long body text from extractor.',
    });

    expect(ingested.pagesDelta).toBe(1);
    expect(ingested.searchesDelta).toBe(0);
    expect(ingested.evidenceIds).toEqual([snip.id]);

    const listed = listEvidences(run.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.snippet).toBe('short snippet');
    expect(listed[0]?.content).toBe('Long body text from extractor.');
    expect(listed[0]?.title).toBe('Full title');
  });

  it('token-truncates content to remaining node budget', () => {
    const run = getOrm()
      .insert(researchRuns)
      .values({
        notebookId,
        topic: 'c107 truncate',
        status: 'running',
        useNotebookSources: false,
        allowWeb: true,
        depth: 'shallow',
        maxSearches: 8,
        maxNodes: 12,
        searchesUsed: 0,
        maxPageFetches: 12,
        pagesUsed: 0,
        graph: { nodes: [], edges: [] },
      })
      .returning()
      .get();

    const long = 'word '.repeat(500);
    const budget = 20;
    const ingested = ingestWorkToolResult(
      run.id,
      notebookId,
      'n2',
      'fetchPage',
      {
        ok: true,
        url: 'https://example.com/long',
        title: 'Long',
        content: long,
      },
      { contentTokenBudgetRemaining: budget },
    );

    expect(ingested.pagesDelta).toBe(1);
    const ev = listEvidences(run.id).find((e) => e.url === 'https://example.com/long');
    expect(ev?.content).toBeTruthy();
    expect(countTokens(ev!.content!)).toBeLessThanOrEqual(budget);
    expect(ev!.content).toBe(truncateToTokens(long, budget));
  });

  it('failed fetchPage does not increment pagesDelta', () => {
    const run = getOrm()
      .insert(researchRuns)
      .values({
        notebookId,
        topic: 'c107 fail',
        status: 'running',
        useNotebookSources: false,
        allowWeb: true,
        depth: 'shallow',
        maxSearches: 8,
        maxNodes: 12,
        searchesUsed: 0,
        maxPageFetches: 12,
        pagesUsed: 0,
        graph: { nodes: [], edges: [] },
      })
      .returning()
      .get();

    insertEvidence(run.id, notebookId, {
      kind: 'web',
      title: 'SERP',
      snippet: 'keep me',
      url: 'https://example.com/fail',
      collectedAtNodeId: 'n3',
    });

    const ingested = ingestWorkToolResult(run.id, notebookId, 'n3', 'fetchPage', {
      ok: false,
      url: 'https://example.com/fail',
      error: 'All extractors failed',
    });

    expect(ingested.pagesDelta).toBe(0);
    expect(ingested.searchesDelta).toBe(0);
    const listed = listEvidences(run.id);
    expect(listed[0]?.snippet).toBe('keep me');
    expect(listed[0]?.content).toBeUndefined();
  });

  it('upsertWebEvidenceContent inserts when URL is new', () => {
    const run = getOrm()
      .insert(researchRuns)
      .values({
        notebookId,
        topic: 'c107 upsert new',
        status: 'running',
        useNotebookSources: false,
        allowWeb: true,
        depth: 'shallow',
        maxSearches: 8,
        maxNodes: 12,
        searchesUsed: 0,
        maxPageFetches: 12,
        pagesUsed: 0,
        graph: { nodes: [], edges: [] },
      })
      .returning()
      .get();

    const ev = upsertWebEvidenceContent(
      run.id,
      notebookId,
      'n4',
      'https://example.com/new',
      'New page',
      'body',
    );
    expect(ev.content).toBe('body');
    expect(listEvidences(run.id)).toHaveLength(1);
  });
});

describe('create run sets maxPageFetches', () => {
  it('medium depth → maxSearches=50 → maxPageFetches=75', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'c107 create budget',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'medium',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: number;
      maxSearches: number;
      maxPageFetches: number;
      pagesUsed: number;
    };
    expect(body.maxSearches).toBe(50);
    expect(body.maxPageFetches).toBe(75);
    expect(body.pagesUsed).toBe(0);

    const row = getOrm().select().from(researchRuns).where(eq(researchRuns.id, body.id)).get();
    expect(row?.maxPageFetches).toBe(75);
    expect(row?.pagesUsed).toBe(0);
  });
});

describe('fork-run pages + content', () => {
  it('resets pagesUsed, copies maxPageFetches and evidence content', async () => {
    const { forkRunFromRevision } = await import('../../src/features/research/report-revisions.ts');
    const { newId } = await import('../../src/features/research/research-core.ts');
    const { researchRevisions } = await import('../../src/db/schema.ts');

    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'c107 fork pages',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: number; maxPageFetches: number };

    const evId = newId('ev');
    insertEvidence(created.id, notebookId, {
      id: evId,
      kind: 'web',
      title: 'With body',
      snippet: 'snip',
      content: 'full page body',
      url: 'https://example.com/fork',
      collectedAtNodeId: 'n1',
    });

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

    getOrm()
      .update(researchRuns)
      .set({
        status: 'completed',
        graph,
        pagesUsed: 5,
        searchesUsed: 2,
        confirmKind: null,
        cancelRequested: false,
      })
      .where(eq(researchRuns.id, created.id))
      .run();

    const revId = newId('rev');
    getOrm()
      .insert(researchRevisions)
      .values({
        id: revId,
        runId: created.id,
        notebookId,
        label: 'fork-pages',
        kind: 'user_save',
        graph,
        report: null,
        searchesUsed: 2,
        statusAtSave: 'completed',
      })
      .run();

    const forked = forkRunFromRevision(notebookId, created.id, revId);
    expect(forked.pagesUsed).toBe(0);
    expect(forked.maxPageFetches).toBe(created.maxPageFetches);
    expect(forked.searchesUsed).toBe(0);
    const copied = forked.evidences.find((e) => e.url === 'https://example.com/fork');
    expect(copied?.content).toBe('full page body');
    expect(copied?.snippet).toBe('snip');
    expect(copied?.id).not.toBe(evId);
  });
});
