/**
 * c94: after decompose, each research node gets a work-unit + evidence writeback.
 * Mocks AI / web-search before createApp.
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
      { title: '库盘点', query: 'xlsx libraries', edgeKind: 'decompose' },
      { title: '性能', query: 'memory streaming', edgeKind: 'decompose' },
      { title: '生态', query: 'ecosystem maturity', edgeKind: 'decompose' },
    ],
  }),
});
seedChatModel();

import { notebooks } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'research-c94-nb' }).returning().get().id;
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

describe('research branch work-units (c94)', () => {
  it('drains each research node with evidenceIds; merge edges remain', async () => {
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'xlsx library choice',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'deep',
        }),
      }),
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: number };
    await waitForStatus(created.id, ['awaiting_confirm', 'completed', 'failed']);

    const get = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
    );
    const run = (await get.json()) as {
      status: string;
      nodes: Array<{
        id: string;
        role?: string;
        title: string;
        evidenceIds?: string[];
        conclusionStatus?: string;
        phase?: string;
      }>;
      edges: Array<{ kind: string; from: string; to: string }>;
    };
    expect(run.status).not.toBe('failed');

    const research = run.nodes.filter((n) => n.role === 'research');
    expect(research.length).toBe(3);
    for (const n of research) {
      expect((n.evidenceIds ?? []).length).toBeGreaterThan(0);
      expect(n.conclusionStatus).toBe('partial');
      expect(n.phase).toBe('idle');
    }

    const mergeToConclusion = run.edges.filter((e) => e.kind === 'merge');
    expect(mergeToConclusion.length).toBeGreaterThanOrEqual(3);

    // F2: work-unit start order follows graph.nodes research insertion order
    const progressRes = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/progress`),
    );
    const progress = (await progressRes.json()) as {
      items: Array<{ kind: string; nodeId?: string | null; headline?: string }>;
    };
    const startedIds = progress.items
      .filter(
        (e) => e.kind === 'unit_started' && e.nodeId && research.some((n) => n.id === e.nodeId),
      )
      .map((e) => e.nodeId as string);
    // Deduplicate consecutive repeats if ledger ever double-emits; order must match graph.
    const orderedUnique = startedIds.filter((id, i) => startedIds[i - 1] !== id);
    expect(orderedUnique).toEqual(research.map((n) => n.id));
  });
});
