// c117 — deep-research runtime bare rules:
// - r94: agent-chosen page reads — the work-unit tool loop is bounded by config
//   workUnitMaxSteps, budgets are exposed to the agent, and the runtime never
//   auto-reads Top-N URLs after a webSearch (only agent tool calls fetch pages)
// - r431: client-authored graph/closure submission is rejected (no such route);
//   the graph changes only through command ports (prune/fork/PATCH/...)
// - r432: node chat body events (chunk/proposal/done) never appear in the run
//   stream event name set (schema-level disjointness + behavioral lock)
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

mock.module('../../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => [],
  webSearchTool: () => ({}),
}));

// Recording 'ai' mock: ToolLoopAgent construction settings are captured so
// prepareCall can be exercised directly (stopWhen wiring), and stream() yields
// a single SERP webSearch tool-result — no fetchPage call — to prove the
// runtime performs no automatic Top-N page reads.
const S = globalThis as Record<string | symbol, unknown>;

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked 短综合' }),
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
  ToolLoopAgent: class {
    constructor(settings: unknown) {
      S.__c117AgentSettings = settings;
    }
    async stream(args: { prompt?: string; options?: Record<string, unknown> } = {}) {
      S.__c117LastStreamArgs = args;
      const parts: Array<Record<string, unknown>> = [];
      if (args.options?.mode === 'work_unit') {
        parts.push({
          type: 'tool-result',
          toolName: 'webSearch',
          output: [
            {
              title: 'SERP hit',
              url: 'https://example.com/serp',
              snippet: 'SERP snippet about the topic.',
              source: 'mock',
            },
          ],
        });
        parts.push({ type: 'text-delta', text: 'agent work done' });
      } else {
        parts.push({ type: 'text-delta', text: 'mock chat reply' });
      }
      const make = async function* () {
        for (const p of parts) yield p;
      };
      return {
        stream: make(),
        fullStream: make(),
        textStream: (async function* () {
          yield 'mock chat reply';
        })(),
      };
    }
  },
  // Structured stopWhen marker so tests can lock which max-steps value flows in.
  isStepCount: (maxSteps: number) => ({ kind: 'stepCount', maxSteps }),
}));

import { ResearchNodeChatStreamEventSchema, ResearchStreamEventSchema } from '@crystalith/shared';
import { eq } from 'drizzle-orm';

import { notebooks, researchRuns } from '../../src/db/schema.ts';
import { createNodeChatSseResponse } from '../../src/features/research/node-chat.ts';
import { createResearchSseResponse } from '../../src/features/research/run-sse.ts';
import { runNodeWorkUnit } from '../../src/features/research/work-unit.ts';
import { createApp } from '../../src/server.ts';
import { getWorkUnitMaxSteps } from '../../src/shared/config-research.ts';
import { resetConfig } from '../../src/shared/config.ts';
import {
  getOrm,
  seedChatModel,
  setupIntegrationEnv,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;
let runSeq = 0;

beforeAll(() => {
  setupIntegrationEnv();
  seedChatModel();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'c117-dr-runtime' }).returning().get().id;
});

afterAll(teardownIntegrationEnv);

function seedRun(graph: unknown, status = 'running'): number {
  runSeq += 1;
  return getOrm()
    .insert(researchRuns)
    .values({
      notebookId,
      topic: `c117 dr runtime ${runSeq}`,
      status,
      useNotebookSources: false,
      allowWeb: true,
      maxSearches: 5,
      maxNodes: 10,
      maxPageFetches: 4,
      pagesUsed: 0,
      searchesUsed: 0,
      graph,
    })
    .returning()
    .get().id;
}

function runGraph(runId: number): unknown {
  return getOrm()
    .select({ graph: researchRuns.graph })
    .from(researchRuns)
    .where(eq(researchRuns.id, runId))
    .get()?.graph;
}

function runRow(runId: number): { pagesUsed: number; searchesUsed: number; status: string } {
  const r = getOrm()
    .select({
      pagesUsed: researchRuns.pagesUsed,
      searchesUsed: researchRuns.searchesUsed,
      status: researchRuns.status,
    })
    .from(researchRuns)
    .where(eq(researchRuns.id, runId))
    .get();
  return {
    pagesUsed: r?.pagesUsed ?? 0,
    searchesUsed: r?.searchesUsed ?? 0,
    status: r?.status ?? '',
  };
}

const seedChatModelConfig = () => seedChatModel();

// ---------------------------------------------------------------------------
// r94 — agent-chosen page reads bounded by workUnitMaxSteps
// ---------------------------------------------------------------------------

interface PrepareCallShape {
  prepareCall: (args: { options: Record<string, unknown> }) => {
    stopWhen?: { kind: string; maxSteps: number };
    instructions: string;
  };
}

describe('c117 r94: work-unit tool loop is bounded by config workUnitMaxSteps', () => {
  it('work_unit stop condition takes workUnitMaxSteps from config; chat uses its own cap', async () => {
    const { createResearchNodeAgent } = await import('../../src/features/research/node-agent.ts');
    const agent = await createResearchNodeAgent(notebookId);
    expect(agent).not.toBeNull();
    const settings = S.__c117AgentSettings as PrepareCallShape;

    const workOptions = {
      mode: 'work_unit',
      role: 'research',
      nodeId: 'n1',
      nodeTitle: '节点',
      allowWeb: true,
      useNotebookSources: false,
      pagesRemaining: 4,
      pageSoft: 2,
    };

    // Default: the work-unit loop stops via isStepCount(workUnitMaxSteps).
    const call = settings.prepareCall({ options: workOptions });
    expect(call.stopWhen).toEqual({ kind: 'stepCount', maxSteps: getWorkUnitMaxSteps() });
    // Instructions expose the remaining page budget and the per-node soft cap.
    expect(call.instructions).toContain('剩余读页 4');
    expect(call.instructions).toContain('本节点读页软上限 2');

    // Config-driven: raising/setting research.work_unit_max_steps flows through.
    resetConfig({
      models: { defaults: { chat: 'test-chat' }, available: [] },
      raw: { research: { work_unit_max_steps: 4 } },
    });
    expect(settings.prepareCall({ options: workOptions }).stopWhen).toEqual({
      kind: 'stepCount',
      maxSteps: 4,
    });

    // Contrast: node_chat is bounded by node_chat_max_steps, not the work-unit cap.
    resetConfig({
      models: { defaults: { chat: 'test-chat' }, available: [] },
      raw: { research: { work_unit_max_steps: 4, node_chat_max_steps: 2 } },
    });
    const chatCall = settings.prepareCall({
      options: { ...workOptions, mode: 'node_chat' },
    });
    expect(chatCall.stopWhen).toEqual({ kind: 'stepCount', maxSteps: 2 });

    resetConfig(null);
    seedChatModelConfig();
  });

  it('runtime does not auto-read Top-N after webSearch; budgets are exposed to the agent', async () => {
    const runId = seedRun({
      nodes: [{ id: 'n1', role: 'research', title: '研究节点', conclusionStatus: 'pending' }],
      edges: [],
    });

    const result = await runNodeWorkUnit({
      runId,
      notebookId,
      node: { id: 'n1', role: 'research', title: '研究节点', conclusionStatus: 'pending' },
      topic: 'c117 topic',
      allowWeb: true,
      useNotebookSources: false,
      sourceIds: null,
      searchesUsed: 0,
      maxSearches: 5,
      abortSignal: new AbortController().signal,
    });

    expect(result.via).toBe('agent');

    // The SERP hit is ingested as snippet-only evidence…
    const { listEvidences } = await import('../../src/features/research/research-core.ts');
    const evidences = await listEvidences(runId);
    expect(evidences).toHaveLength(1);
    expect(evidences[0]?.kind).toBe('web');
    expect(evidences[0]?.snippet).toBeTruthy();
    // …and no runtime Top-N fetchPage upgraded it: no content, no page spend.
    expect(evidences[0]?.content).toBeUndefined();
    expect(runRow(runId).pagesUsed).toBe(0);

    // The agent call exposed the remaining budgets in the prompt and options.
    const streamArgs = S.__c117LastStreamArgs as {
      prompt: string;
      options: { pagesRemaining: number; pageSoft: number; searchesRemaining: number };
    };
    expect(streamArgs.options.pagesRemaining).toBe(4);
    expect(streamArgs.options.pageSoft).toBe(4);
    expect(streamArgs.options.searchesRemaining).toBe(5);
    expect(streamArgs.prompt).toContain('剩余读页 4');
    expect(streamArgs.prompt).toContain('本节点读页软上限 4');
    expect(streamArgs.prompt).toContain('剩余搜索 5');
  });
});

// ---------------------------------------------------------------------------
// r431 — client-authored closure / whole-graph submission is rejected
// ---------------------------------------------------------------------------

describe('c117 r431: client-authored graph submission is rejected', () => {
  it('non-command-port graph/closure routes do not exist and the graph is unchanged', async () => {
    const graph = {
      nodes: [
        { id: 'node_root_q', role: 'question', title: '问题', conclusionStatus: 'clear' },
        { id: 'n1', role: 'research', title: '支路A', conclusionStatus: 'partial' },
      ],
      edges: [{ id: 'e1', source: 'node_root_q', target: 'n1', kind: 'decompose' }],
    };
    const runId = seedRun(graph);

    const fabricated = {
      nodes: [
        { id: 'n1', role: 'research', title: '客户端伪剪枝', conclusionStatus: 'pruned' },
        { id: 'node_root_q', role: 'question', title: '问题', conclusionStatus: 'pruned' },
      ],
      edges: [],
    };
    const prefix = `${BASE}/v2/notebooks/${notebookId}/research/${runId}`;
    const probes: Array<[string, string]> = [
      ['PUT', `${prefix}/graph`],
      ['POST', `${prefix}/graph`],
      ['PATCH', `${prefix}/graph`],
      ['POST', `${prefix}/nodes`],
      ['PUT', `${prefix}`],
    ];
    for (const [method, url] of probes) {
      const res = await app.handle(
        new Request(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fabricated),
        }),
      );
      // The interface does not exist (or the method is rejected) — never 2xx.
      expect([404, 405]).toContain(res.status);
    }

    // The fabricated closure was not applied as SSOT.
    expect(runGraph(runId)).toEqual(graph);

    // Positive control: the command port (node PATCH) works on the same run.
    const patch = await app.handle(
      new Request(`${prefix}/nodes/n1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '支路A（改名）' }),
      }),
    );
    expect(patch.status).toBe(200);
    expect(
      (runGraph(runId) as { nodes: Array<{ id: string; title: string }> }).nodes.find(
        (n) => n.id === 'n1',
      )?.title,
    ).toBe('支路A（改名）');
  });
});

// ---------------------------------------------------------------------------
// r432 — chat body events never appear in the run stream event name set
// ---------------------------------------------------------------------------

function sseEventNames(schema: unknown): string[] {
  const union = schema as { options: Array<{ shape: { event: { value: string } } }> };
  return union.options.map((o) => o.shape.event.value);
}

describe('c117 r432: chat SSE is separate from the run stream event set', () => {
  it('chat body events (chunk/proposal/done) are not run stream event names (schema lock)', async () => {
    const runEvents = sseEventNames(ResearchStreamEventSchema);
    const chatEvents = sseEventNames(ResearchNodeChatStreamEventSchema);

    expect(runEvents).toEqual(
      expect.arrayContaining([
        'status',
        'graph_patch',
        'confirm',
        'report_ready',
        'log',
        'error',
        'progress',
      ]),
    );
    for (const bodyEvent of ['chunk', 'proposal', 'done']) {
      expect(chatEvents).toContain(bodyEvent);
      expect(runEvents).not.toContain(bodyEvent);
    }
  });

  it('a node chat emits chunk/done on its own response while the run stream stays clean', async () => {
    const graph = {
      nodes: [{ id: 'n1', role: 'research', title: '研究节点', conclusionStatus: 'pending' }],
      edges: [],
    };
    const runId = seedRun(graph);

    const runRes = await createResearchSseResponse(notebookId, runId);
    const reader = (runRes.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    const readChunk = async (ms: number): Promise<string | null> =>
      Promise.race([
        reader.read().then((r) => (r.done ? null : decoder.decode(r.value, { stream: true }))),
        Bun.sleep(ms).then(() => null),
      ]);

    let runText = '';
    // Initial replay: status + graph_patch (graph has one node).
    for (let i = 0; i < 8; i++) {
      const chunk = await readChunk(150);
      if (chunk === null) break;
      runText += chunk;
    }

    // Node chat on the same run — body events must stay on the chat stream.
    const chatRes = await createNodeChatSseResponse(notebookId, runId, 'n1', { message: '你好' });
    const chatText = await chatRes.text();
    expect(chatText).toContain('event: chunk');
    expect(chatText).toContain('event: done');

    // Drain any late run-stream frames, then release the connection.
    let tail = '';
    for (let i = 0; i < 6; i++) {
      const chunk = await readChunk(100);
      if (chunk === null) break;
      tail += chunk;
    }
    await reader.cancel();

    const allRunStream = runText + tail;
    expect(allRunStream).toContain('event: status');
    expect(allRunStream).toContain('event: graph_patch');
    // Chat body events never leaked into the run stream.
    expect(allRunStream).not.toContain('event: chunk');
    expect(allRunStream).not.toContain('event: proposal');
    expect(allRunStream).not.toContain('event: done');
  });
});
