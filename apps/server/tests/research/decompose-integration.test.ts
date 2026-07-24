/**
 * Integration: when generateObject returns branches, run graph gains research nodes + edges.
 * Mocks AI before importing createApp (same pattern as runtime.test.ts).
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
  notebookId = getOrm().insert(notebooks).values({ name: 'research-c93-nb' }).returning().get().id;
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

describe('research decompose integration (c93)', () => {
  it('seeds research nodes with decompose+merge when planner returns branches', async () => {
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'xlsx library choice',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'medium',
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
      nodes: Array<{ role?: string }>;
      edges: Array<{ kind: string }>;
    };
    const research = run.nodes.filter((n) => n.role === 'research');
    expect(research.length).toBeGreaterThanOrEqual(2);
    expect(run.edges.some((e) => e.kind === 'decompose')).toBe(true);
    expect(run.edges.some((e) => e.kind === 'merge')).toBe(true);
  });
});
