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

interface RunBody {
  status: string;
  nodes?: Array<{ role?: string }>;
}

const TERMINAL_STATUSES = ['completed', 'cancelled', 'failed'] as const;

function isTerminal(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

function isLiveWindow(body: RunBody): boolean {
  const hasResearch = (body.nodes ?? []).some((n) => n.role === 'research');
  return hasResearch && (body.status === 'running' || body.status === 'awaiting_confirm');
}

async function fetchRun(id: number): Promise<RunBody> {
  const res = await app.handle(new Request(`${BASE}/v2/notebooks/${notebookId}/research/${id}`));
  return (await res.json()) as RunBody;
}

/** Poll the run until `isDone` holds; red-fails via timeout error. */
async function pollRun(
  id: number,
  deadlineMs: number,
  isDone: (b: RunBody) => boolean,
): Promise<RunBody> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    const body = await fetchRun(id);
    if (isDone(body)) return body;
    if (Date.now() > deadline) throw new Error(`poll timeout, last status: ${body.status}`);
    await Bun.sleep(40);
  }
}

async function postJson(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const res = await app.handle(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
}

beforeAll(() => {
  process.env.CL_RESEARCH_E2E_STUB = '1';
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'e2e-r02-race' }).returning().get().id;
});

afterAll(async () => {
  delete process.env.CL_RESEARCH_E2E_STUB;
  await teardownIntegrationEnv();
});

describe('e2e stub reexpand skip race (R02)', () => {
  it('live → request-reexpand → skip_reexpand → completed (not cancelled)', async () => {
    const create = await postJson(`/v2/notebooks/${notebookId}/research`, {
      topic: 'e2e reexpand skip path',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'shallow',
    });
    expect(create.status).toBe(201);
    const { id } = create.body as { id: number };

    const liveOrTerminal = await pollRun(
      id,
      10_000,
      (b) => isLiveWindow(b) || isTerminal(b.status),
    );
    if (isTerminal(liveOrTerminal.status)) {
      throw new Error(`terminal before live window: ${liveOrTerminal.status}`);
    }

    const rr = await postJson(`/v2/notebooks/${notebookId}/research/${id}/request-reexpand`, {});
    expect(rr.status).toBe(200);
    const paused = rr.body as { status: string; confirmKind: string | null };
    expect(paused.status).toBe('awaiting_confirm');
    expect(paused.confirmKind).toBe('reexpand');

    // Immediate skip while the aborted runLoop is still unwinding (no artificial delay).
    const sk = await postJson(`/v2/notebooks/${notebookId}/research/${id}/confirm`, {
      action: 'skip_reexpand',
    });
    expect(sk.status).toBe(200);
    const skipped = sk.body as { status: string };
    expect(skipped.status).not.toBe('cancelled');

    const final = await pollRun(id, 15_000, (b) => isTerminal(b.status));
    expect(final.status).toBe('completed');
  });
});
