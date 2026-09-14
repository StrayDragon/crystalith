/**
 * c63 / r12: node chat failure honesty.
 *
 * - Model failure (agent throws / no chat model) MUST terminate the turn with
 *   a chat SSE `error` event + `chat_failed` ledger event, never a stub reply.
 * - `stubNodeChatTurn` is only reachable behind CL_RESEARCH_E2E_STUB=1.
 * - Emit contract: every frame conforms to the shared
 *   ResearchNodeChatStreamEventSchema discriminated union.
 */
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

mock.module('../../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => [],
  webSearchTool: () => ({}),
}));

// Agent factory is mocked for deterministic failure modes. `globalThis`
// (not a module-local) so the hoisted factory can always read it.
type AgentMode = 'reject' | 'no_model' | 'stream';
const agentModeKey = '__c63ChatAgentMode' as const;

mock.module('../../src/features/research/node-agent.ts', () => ({
  createResearchNodeAgent: async () => {
    const mode = ((globalThis as Record<symbol | string, unknown>)[agentModeKey] ??
      'reject') as AgentMode;
    if (mode === 'no_model') return null;
    if (mode === 'stream') {
      return {
        stream: async () => ({
          stream: (async function* () {
            yield { type: 'text-delta', text: '真实模型回复' };
          })(),
        }),
      };
    }
    return {
      stream: async () => {
        throw new Error('gateway down (c63 mock)');
      },
    };
  },
  proposalFromStructureToolCall: () => null,
}));

import { ResearchNodeChatStreamEventSchema } from '@crystalith/shared';
import { eq } from 'drizzle-orm';

import { notebooks, researchProgressEvents, researchRuns } from '../../src/db/schema.ts';
import { createNodeChatSseResponse } from '../../src/features/research/node-chat.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

let notebookId: number;
let runId: number;
const NODE_ID = 'n_c63_chat';

beforeAll(() => {
  setupIntegrationEnv();
  notebookId = getOrm()
    .insert(notebooks)
    .values({ name: 'research-c63-chat-honesty' })
    .returning()
    .get().id;
  runId = getOrm()
    .insert(researchRuns)
    .values({
      notebookId,
      topic: 'c63 chat honesty',
      status: 'queued',
      useNotebookSources: false,
      allowWeb: false,
      maxSearches: 5,
      maxNodes: 10,
      maxPageFetches: 5,
      graph: {
        nodes: [{ id: NODE_ID, title: '被测节点', conclusionStatus: 'pending' }],
        edges: [],
      },
    })
    .returning()
    .get().id;
});

afterAll(() => {
  delete (globalThis as Record<symbol | string, unknown>)[agentModeKey];
  delete process.env.CL_RESEARCH_E2E_STUB;
  teardownIntegrationEnv();
});

interface SseFrame {
  event: string;
  // deno-lint-ignore no-explicit-any
  data: Record<string, any>;
}

function parseFrames(text: string): SseFrame[] {
  return text
    .split('\n\n')
    .filter((block) => block.trim().length > 0 && !block.startsWith(':'))
    .map((block) => {
      const event = /^event: (.+)$/m.exec(block)?.[1] ?? '';
      const dataRaw = /^data: (.+)$/m.exec(block)?.[1] ?? '{}';
      return { event, data: JSON.parse(dataRaw) as SseFrame['data'] };
    });
}

function progressKinds(): string[] {
  return ledgerRows().map((r) => r.kind);
}

function ledgerRows(): Array<{ kind: string; headline: string | null; payload: unknown }> {
  return getOrm()
    .select({
      kind: researchProgressEvents.kind,
      headline: researchProgressEvents.headline,
      payload: researchProgressEvents.payload,
    })
    .from(researchProgressEvents)
    .where(eq(researchProgressEvents.runId, runId))
    .all();
}

async function runChat(): Promise<SseFrame[]> {
  const res = createNodeChatSseResponse(notebookId, runId, NODE_ID, { message: '总结一下' });
  return parseFrames(await res.text());
}

describe('node chat failure honesty (c63 / r12)', () => {
  it('agent rejection → error frame + chat_failed ledger, no stub chunks', async () => {
    (globalThis as Record<symbol | string, unknown>)[agentModeKey] = 'reject';
    const frames = await runChat();

    expect(frames.some((f) => f.event === 'chunk')).toBe(false);
    expect(frames.some((f) => f.event === 'proposal')).toBe(false);
    const errorFrame = frames.find((f) => f.event === 'error');
    expect(errorFrame).toBeDefined();
    expect(errorFrame?.data.message).toBe('模型暂时不可用，请稍后重试');
    expect(typeof errorFrame?.data.errorCode).toBe('string');

    expect(progressKinds()).toContain('chat_failed');
    expect(progressKinds()).not.toContain('chat_finished');
  });

  it('no chat model configured → honest error frame, not a fake reply', async () => {
    (globalThis as Record<symbol | string, unknown>)[agentModeKey] = 'no_model';
    const frames = await runChat();

    expect(frames.some((f) => f.event === 'chunk')).toBe(false);
    const errorFrame = frames.find((f) => f.event === 'error');
    expect(errorFrame?.data.message).toContain('对话模型未配置');
    expect(progressKinds()).toContain('chat_failed');
  });

  it('CL_RESEARCH_E2E_STUB=1 keeps the stub path (text + proposals + via=stub)', async () => {
    (globalThis as Record<symbol | string, unknown>)[agentModeKey] = 'reject';
    process.env.CL_RESEARCH_E2E_STUB = '1';
    // Ledger accumulates across tests on the same run — scope to this turn.
    const before = ledgerRows().length;
    try {
      const frames = await runChat();
      expect(frames.some((f) => f.event === 'chunk')).toBe(true);
      const done = frames.find((f) => f.event === 'done');
      expect(Array.isArray(done?.data.proposals)).toBe(true);
      const turn = ledgerRows().slice(before);
      expect(turn.map((r) => r.kind)).not.toContain('chat_failed');
      expect(turn.map((r) => r.kind)).toContain('chat_finished');
      const finished = turn.at(-1);
      expect(finished?.headline).toBe('节点对话结束');
      expect((finished?.payload as { via?: string })?.via).toBe('stub');
    } finally {
      delete process.env.CL_RESEARCH_E2E_STUB;
    }
  });

  it('agent stream success → chunk/done frames and chat_finished via=agent', async () => {
    (globalThis as Record<symbol | string, unknown>)[agentModeKey] = 'stream';
    const frames = await runChat();
    expect(frames.some((f) => f.event === 'chunk' && f.data.text === '真实模型回复')).toBe(true);
    const done = frames.find((f) => f.event === 'done');
    expect(Array.isArray(done?.data.proposals)).toBe(true);
    expect(frames.some((f) => f.event === 'error')).toBe(false);
    expect(progressKinds()).toContain('chat_finished');
  });

  it('chat SSE mutex is released after the stream ends', async () => {
    (globalThis as Record<symbol | string, unknown>)[agentModeKey] = 'stream';
    await runChat();
    const row = getOrm().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
    expect(row?.llmActivity).toBeNull();
  });
});

describe('chat event contract (shared union)', () => {
  it('all frame kinds conform to ResearchNodeChatStreamEventSchema', () => {
    const samples = [
      { event: 'log', data: { message: 'connected', nodeId: NODE_ID } },
      { event: 'chunk', data: { text: '增量' } },
      {
        event: 'proposal',
        data: {
          id: 'ap_x',
          kind: 'fork_sibling',
          label: '分叉',
          rationale: 'r',
          status: 'pending',
        },
      },
      { event: 'done', data: { proposals: [] } },
      { event: 'error', data: { errorCode: 'INTERNAL_ERROR', message: 'm' } },
    ] as const;
    for (const sample of samples) {
      const parsed = ResearchNodeChatStreamEventSchema.safeParse(sample);
      expect(parsed.success).toBe(true);
    }
    expect(ResearchNodeChatStreamEventSchema.safeParse({ event: 'bogus' }).success).toBe(false);
  });
});
