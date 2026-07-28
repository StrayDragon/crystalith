/**
 * c108 / e2e R02 race: stub hold → request-reexpand → skip_reexpand → completed
 * (must not finalize as cancelled via shared AbortSignal).
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
  text: '# Report\n\nDone. [[1]]',
  object: () => ({
    branches: [
      { title: '支路A', query: 'query a', edgeKind: 'decompose' },
      { title: '支路B', query: 'query b', edgeKind: 'decompose' },
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
  process.env.CL_RESEARCH_E2E_STUB = '1';
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'e2e-r02-race' }).returning().get().id;
});

afterAll(() => {
  delete process.env.CL_RESEARCH_E2E_STUB;
  teardownIntegrationEnv();
});

describe('e2e stub reexpand skip race (c108 R02)', () => {
  it('live → request-reexpand → skip_reexpand → completed (not cancelled)', async () => {
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'e2e reexpand skip path',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'shallow',
        }),
      }),
    );
    expect(create.status).toBe(201);
    const { id } = (await create.json()) as { id: number };

    let live = false;
    const liveDeadline = Date.now() + 10_000;
    while (Date.now() < liveDeadline) {
      const body = (await (
        await app.handle(new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}`))
      ).json()) as { status: string; nodes?: Array<{ role?: string }> };
      const hasResearch = (body.nodes ?? []).some((n) => n.role === 'research');
      if (hasResearch && (body.status === 'running' || body.status === 'awaiting_confirm')) {
        live = true;
        break;
      }
      if (body.status === 'completed' || body.status === 'cancelled' || body.status === 'failed') {
        throw new Error(`terminal before live window: ${body.status}`);
      }
      await Bun.sleep(40);
    }
    expect(live).toBe(true);

    const rr = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}/request-reexpand`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    expect(rr.status).toBe(200);
    const paused = (await rr.json()) as { status: string; confirmKind: string | null };
    expect(paused.status).toBe('awaiting_confirm');
    expect(paused.confirmKind).toBe('reexpand');

    // Immediate skip while the aborted runLoop is still unwinding (no artificial delay).
    const sk = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'skip_reexpand' }),
      }),
    );
    expect(sk.status).toBe(200);
    const skipped = (await sk.json()) as { status: string };
    expect(skipped.status).not.toBe('cancelled');

    const endDeadline = Date.now() + 15_000;
    let finalStatus = skipped.status;
    while (Date.now() < endDeadline) {
      const body = (await (
        await app.handle(new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}`))
      ).json()) as { status: string };
      finalStatus = body.status;
      if (body.status === 'completed' || body.status === 'cancelled' || body.status === 'failed') {
        break;
      }
      await Bun.sleep(40);
    }
    expect(finalStatus).toBe('completed');
  });
});
