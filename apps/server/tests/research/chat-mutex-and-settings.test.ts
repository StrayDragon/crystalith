/**
 * W3 runtime compliance locks:
 * - r98: runLoop MUST NOT claim the LLM mutex while a node chat holds it
 *   (queue until release; bounded wait, then give up without stomping).
 * - Research settings defaults are a single SSOT (schema defaults === fallback
 *   constant), and nodeChatMaxSteps flows into getNodeChatMaxSteps().
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

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
      { title: '支路A', query: 'query a', edgeKind: 'decompose' },
      { title: '支路B', query: 'query b', edgeKind: 'decompose' },
    ],
  }),
});
seedChatModel();

import { eq } from 'drizzle-orm';

import { notebooks, researchRuns } from '../../src/db/schema.ts';
import { ensureRunAbortController, updateRun } from '../../src/features/research/research-core.ts';
import { runLoop } from '../../src/features/research/run-loop.ts';
import {
  RESEARCH_SETTINGS_DEFAULTS,
  ResearchSettingsSchema,
  getNodeChatMaxSteps,
  resetConfig,
} from '../../src/shared/config.ts';

let notebookId: number;
let runSeq = 0;

// Explicit high ids: bun:test shares one process (and the module-level
// activeLoops / db() singletons) across files — a small autoincrement id can
// collide with a lingering loop from another test file's run.
const RUN_ID_BASE = 9_000_000;

function seedRun(llmActivity: 'node_chat' | null): number {
  runSeq += 1;
  return getOrm()
    .insert(researchRuns)
    .values({
      id: RUN_ID_BASE + runSeq,
      notebookId,
      topic: `w3 mutex ${runSeq}`,
      status: 'queued',
      useNotebookSources: false,
      allowWeb: false,
      maxSearches: 5,
      maxNodes: 10,
      maxPageFetches: 5,
      llmActivity,
      graph: { nodes: [], edges: [] },
    })
    .returning()
    .get().id;
}

function row(runId: number): { status: string; llmActivity: string | null } {
  const r = getOrm()
    .select({ status: researchRuns.status, llmActivity: researchRuns.llmActivity })
    .from(researchRuns)
    .where(eq(researchRuns.id, runId))
    .get();
  return { status: r?.status ?? '', llmActivity: r?.llmActivity ?? null };
}

beforeAll(() => {
  setupIntegrationEnv();
  notebookId = getOrm()
    .insert(notebooks)
    .values({ name: 'research-w3-compliance' })
    .returning()
    .get().id;
});

afterAll(teardownIntegrationEnv);

describe('runLoop chat mutex (W3 / r98)', () => {
  it('queues while node_chat holds the mutex, then claims work_unit on release', async () => {
    const runId = seedRun('node_chat');
    const loop = runLoop(runId, 5000);

    await Bun.sleep(400);
    // Still held: the loop must not have claimed the mutex or started running.
    expect(row(runId)).toEqual({ status: 'queued', llmActivity: 'node_chat' });

    // Simulate the chat stream ending → mutex released. The loop's 250ms
    // poll then proceeds with the run; under the AI mock the whole pipeline
    // can finish fast, so assert the outcome (status left 'queued') instead
    // of racing the transient work_unit claim.
    updateRun(runId, { llmActivity: null });
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && row(runId).status === 'queued') {
      await Bun.sleep(50);
    }
    expect(row(runId).status).not.toBe('queued');

    // Contain the loop if it is still running: abort so it bails.
    ensureRunAbortController(runId).abort();
    await loop;
  }, 20000);

  it('gives up without claiming when the chat wait budget is exceeded', async () => {
    const runId = seedRun('node_chat');
    await runLoop(runId, 400);

    expect(row(runId)).toEqual({ status: 'queued', llmActivity: 'node_chat' });
  }, 10000);
});

describe('research settings SSOT (W3)', () => {
  it('schema defaults equal the single defaults constant', () => {
    expect(ResearchSettingsSchema.parse({})).toEqual(RESEARCH_SETTINGS_DEFAULTS);
  });

  it('node_chat_max_steps flows from config into getNodeChatMaxSteps', () => {
    resetConfig({
      models: { defaults: {}, available: [] },
      raw: { research: { node_chat_max_steps: 3 } },
    });
    expect(getNodeChatMaxSteps()).toBe(3);

    // Missing/invalid section falls back to the same SSOT constant.
    resetConfig({ models: { defaults: {}, available: [] }, raw: {} });
    expect(getNodeChatMaxSteps()).toBe(RESEARCH_SETTINGS_DEFAULTS.node_chat_max_steps);
    expect(getNodeChatMaxSteps()).toBe(8);

    // Pre-r249 camelCase key still works through the deprecation alias (W8).
    resetConfig({
      models: { defaults: {}, available: [] },
      raw: { research: { nodeChatMaxSteps: 5 } },
    });
    expect(getNodeChatMaxSteps()).toBe(5);

    resetConfig(null);
  });
});
