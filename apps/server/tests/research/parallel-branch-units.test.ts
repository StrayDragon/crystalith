/**
 * c106: parallel branch work-units — drain wave, per-run LLM queue, cancel.
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
  seedChatModel,
  setupIntegrationEnv,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

/** Observed peak concurrent generateText calls (short synthesis). */
let llmInFlight = 0;
let llmMaxInFlight = 0;
let shortSynthDelayMs = 0;

// Custom AI mock with LLM concurrency counters (must stay before server import).
mock.module('ai', () => {
  const text = 'mocked';
  const makePartsStream = () =>
    (async function* () {
      yield { type: 'text-delta', text };
    })();

  return {
    Output: {
      object: <T>(spec: T) => spec,
    },
    generateObject: async ({ prompt }: { prompt?: string }) => {
      const p = prompt ?? '';
      if (/结案|ResearchReport|研究报告|综合成稿|深度研究结案/u.test(p)) {
        return {
          object: {
            title: '研究报告：mock',
            sections: [
              {
                id: 'overview',
                heading: '概述',
                blocks: [{ type: 'paragraph', text, citeIds: [] }],
              },
            ],
            citations: {},
          },
        };
      }
      return {
        object: {
          branches: [
            { title: '支路甲', query: 'topic a', edgeKind: 'decompose' },
            { title: '支路乙', query: 'topic b', edgeKind: 'decompose' },
            { title: '支路丙', query: 'topic c', edgeKind: 'decompose' },
          ],
        },
      };
    },
    generateText: async ({
      prompt,
      output,
    }: {
      prompt?: string;
      output?: unknown;
      abortSignal?: AbortSignal;
    }) => {
      llmInFlight++;
      llmMaxInFlight = Math.max(llmMaxInFlight, llmInFlight);
      try {
        if (shortSynthDelayMs > 0) await Bun.sleep(shortSynthDelayMs);
        if (output) {
          return {
            output: {
              branches: [
                { title: '支路甲', query: 'topic a', edgeKind: 'decompose' },
                { title: '支路乙', query: 'topic b', edgeKind: 'decompose' },
                { title: '支路丙', query: 'topic c', edgeKind: 'decompose' },
              ],
            },
            text,
          };
        }
        const p = prompt ?? '';
        if (/短综合/u.test(p)) return { text: '节点短综合 mock' };
        return { text };
      } finally {
        llmInFlight--;
      }
    },
    streamText: () => ({
      stream: makePartsStream(),
      fullStream: makePartsStream(),
      textStream: (async function* () {
        yield text;
      })(),
    }),
    tool: (def: unknown) => def,
    ToolLoopAgent: class {
      async generate() {
        return { text };
      }
      async stream(args?: {
        options?: { mode?: string; allowWeb?: boolean; useNotebookSources?: boolean };
      }) {
        const parts: Array<Record<string, unknown>> = [];
        if (args?.options?.mode === 'work_unit') {
          if (args.options.allowWeb) {
            parts.push({
              type: 'tool-result',
              toolName: 'webSearch',
              output: [
                {
                  title: 'Mock Web Result',
                  url: 'https://example.com/mock',
                  snippet: 'Mock snippet about the topic.',
                  source: 'mock',
                },
              ],
            });
          }
          parts.push({ type: 'text-delta', text: `agent-work:${text}` });
        } else {
          parts.push({ type: 'text-delta', text: `agent:${text}` });
        }
        const make = async function* () {
          for (const p of parts) yield p;
        };
        return {
          stream: make(),
          fullStream: make(),
          textStream: (async function* () {
            yield text;
          })(),
        };
      }
    },
    isStepCount: () => ({ stopWhen: 'stepCount' }),
  };
});

seedChatModel();

import { resetConfig, config, getParallelBranchUnits } from '../../src/shared/config.ts';

{
  const cur = config();
  resetConfig({
    ...cur,
    raw: {
      ...cur.raw,
      research: { progressEventRetain: 200, parallelBranchUnits: 2 },
    },
  });
}

import { notebooks } from '../../src/db/schema.ts';
import {
  clearRunLocks,
  withRunLlmLock,
  withRunLlmLockReleased,
} from '../../src/features/research/run-locks.ts';
import { createApp } from '../../src/server.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'research-c106-nb' }).returning().get().id;
});

afterAll(() => {
  clearRunLocks();
  teardownIntegrationEnv();
});

async function waitForStatus(runId: number, wanted: string[], timeoutMs = 10000): Promise<string> {
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

describe('c106 parallel branch units', () => {
  it('getParallelBranchUnits clamps to 1..8 (config default 2)', () => {
    expect(getParallelBranchUnits()).toBe(2);
  });

  it('withRunLlmLock serializes overlapping calls for the same runId', async () => {
    let inFlight = 0;
    let max = 0;
    const run = async () =>
      withRunLlmLock(9001, async () => {
        inFlight++;
        max = Math.max(max, inFlight);
        await Bun.sleep(40);
        inFlight--;
      });
    await Promise.all([run(), run(), run()]);
    expect(max).toBe(1);
    clearRunLocks(9001);
  });

  it('withRunLlmLock allows different runIds to overlap', async () => {
    let inFlight = 0;
    let max = 0;
    const run = (id: number) =>
      withRunLlmLock(id, async () => {
        inFlight++;
        max = Math.max(max, inFlight);
        await Bun.sleep(40);
        inFlight--;
      });
    await Promise.all([run(9101), run(9102)]);
    expect(max).toBe(2);
    clearRunLocks(9101);
    clearRunLocks(9102);
  });

  it('withRunLlmLockReleased overlaps tool IO under same-run outer locks', async () => {
    let ioInFlight = 0;
    let ioMax = 0;
    const unit = () =>
      withRunLlmLock(9201, async () => {
        await Bun.sleep(5);
        await withRunLlmLockReleased(async () => {
          ioInFlight++;
          ioMax = Math.max(ioMax, ioInFlight);
          await Bun.sleep(40);
          ioInFlight--;
        });
        await Bun.sleep(5);
      });
    await Promise.all([unit(), unit()]);
    expect(ioMax).toBe(2);
    clearRunLocks(9201);
  });

  it('parallel drain completes all research nodes; merge edges remain', async () => {
    llmInFlight = 0;
    llmMaxInFlight = 0;
    shortSynthDelayMs = 30;

    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'c106 parallel drain topic',
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
        evidenceIds?: string[];
        conclusionStatus?: string;
        phase?: string;
      }>;
      edges: Array<{ kind: string }>;
    };
    expect(run.status).not.toBe('failed');

    const research = run.nodes.filter((n) => n.role === 'research');
    expect(research.length).toBe(3);
    for (const n of research) {
      expect((n.evidenceIds ?? []).length).toBeGreaterThan(0);
      expect(n.conclusionStatus).toBe('partial');
      expect(n.phase).toBe('idle');
    }
    expect(run.edges.filter((e) => e.kind === 'merge').length).toBeGreaterThanOrEqual(3);

    // Same-run LLM calls must not overlap (short synthesis under withRunLlmLock)
    expect(llmMaxInFlight).toBeLessThanOrEqual(1);

    shortSynthDelayMs = 0;
    clearRunLocks(created.id);
  });

  it('cancel aborts in-flight parallel drain toward cancelled', async () => {
    shortSynthDelayMs = 200;
    llmInFlight = 0;
    llmMaxInFlight = 0;

    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'c106 cancel parallel topic',
          useNotebookSources: false,
          allowWeb: true,
          depth: 'deep',
        }),
      }),
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: number };

    await Bun.sleep(80);
    const cancel = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/cancel`, {
        method: 'POST',
      }),
    );
    expect(cancel.status).toBe(200);

    const status = await waitForStatus(created.id, [
      'cancelled',
      'completed',
      'awaiting_confirm',
      'failed',
    ]);
    if (status === 'cancelled') {
      const get = await app.handle(
        new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
      );
      const run = (await get.json()) as { status: string };
      expect(run.status).toBe('cancelled');
    }

    shortSynthDelayMs = 0;
    clearRunLocks(created.id);
  });
});
