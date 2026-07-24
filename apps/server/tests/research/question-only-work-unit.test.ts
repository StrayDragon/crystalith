/**
 * c94 regression: empty decompose → question-only work-unit still completes.
 */
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

mock.module('../../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => [
    {
      title: 'Mock Web Result',
      url: 'https://example.com/mock-q',
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
  object: () => ({ branches: [] }),
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
  notebookId = getOrm()
    .insert(notebooks)
    .values({ name: 'research-c94-question-only-nb' })
    .returning()
    .get().id;
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

describe('research question-only path (c94)', () => {
  it('runs question work-unit when decompose yields no branches', async () => {
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'simple topic',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
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
        role?: string;
        evidenceIds?: string[];
        conclusionStatus?: string;
      }>;
    };
    expect(run.status).not.toBe('failed');
    expect(run.nodes.filter((n) => n.role === 'research').length).toBe(0);
    const question = run.nodes.find((n) => n.role === 'question');
    expect(question).toBeTruthy();
    expect((question?.evidenceIds ?? []).length).toBeGreaterThan(0);
  });
});
