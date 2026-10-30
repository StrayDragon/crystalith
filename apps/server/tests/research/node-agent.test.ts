// covers: r86/r91（deep-research-runtime）——节点模型彻底失败标 conclusionStatus=missing 且整 Run 不因此立即 failed；work_unit/node_chat 工具集复用共享 fetchPage 抽取链工具。
// r86: 空证据列表合法 + 彻底失败支路标记 missing（不假命中、不拖垮 Run）。
// r91: agent 工具袋中的 fetchPage 必须来自共享 ai/tools/fetch-page.ts
// （mock 该模块注入标记，断言标记穿透装配 —— research 内自建第二套爬虫时即失败）。
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { eq } from 'drizzle-orm';

// r91 标记替身：共享抽取链模块换成带 __from 标记的工具工厂。
mock.module('../../src/ai/tools/fetch-page.ts', () => ({
  fetchPageTool: () => ({
    __from: 'shared-extractor-chain',
    description: 'shared fetch-page marker',
    execute: async () => ({ ok: true, url: '', title: '', content: '' }),
  }),
}));

mock.module('../../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => [],
  webSearchTool: () => ({}),
}));

// Recording 'ai' mock：
// - ToolLoopAgent 构造参数捕获到 S.__naAgentSettings（r91 直接驱动 prepareCall）。
// - work_unit 流按 nodeId 区分：n_fail 整体抛错（模型彻底失败），其余产出
//   webSearch 空命中 tool-result（r86 空证据合法，无假命中回退）。
// - generateText 对「失败支路」节点短综合抛错 → 该节点走 missing 路径。
const S = globalThis as Record<string | symbol, unknown>;

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async ({ prompt }: { prompt?: string }) => {
    if (prompt && /失败支路/u.test(prompt)) {
      throw new Error('node model total failure');
    }
    return { text: '空证据支路短综合：检索无命中，如实说明。' };
  },
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
  ToolLoopAgent: class {
    constructor(settings: unknown) {
      S.__naAgentSettings = settings;
    }
    async stream(args: { prompt?: string; options?: Record<string, unknown> } = {}) {
      S.__naLastStreamArgs = args;
      const parts: Array<Record<string, unknown>> = [];
      if (args.options?.mode === 'work_unit') {
        if (args.options.nodeId === 'n_fail') {
          throw new Error('agent tool-loop total failure');
        }
        parts.push({ type: 'tool-result', toolName: 'webSearch', output: [] });
        parts.push({ type: 'text-delta', text: 'agent work done (empty serp)' });
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
  isStepCount: (maxSteps: number) => ({ kind: 'stepCount', maxSteps }),
}));

import { notebooks, researchRuns } from '../../src/db/schema.ts';
import {
  createResearchNodeAgent,
  proposalFromStructureToolCall,
} from '../../src/features/research/node-agent.ts';
import {
  ensureRunAbortController,
  listEvidences,
} from '../../src/features/research/research-core.ts';
import { drainResearchWorkUnits } from '../../src/features/research/run-loop.ts';
import {
  getOrm,
  seedChatModel,
  setupIntegrationEnv,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  seedChatModel();
  notebookId = getOrm()
    .insert(notebooks)
    .values({ name: 'node-agent-r86-r91' })
    .returning()
    .get().id;
});

afterAll(teardownIntegrationEnv);

describe('proposalFromStructureToolCall', () => {
  it('maps propose_prune to prune_node ActionProposal', async () => {
    const p = proposalFromStructureToolCall({
      toolName: 'propose_prune',
      toolCallId: 'tc1',
      args: { rationale: '证据不足' },
    });
    expect(p).toEqual({
      id: 'tc1',
      kind: 'prune_node',
      label: '剪枝此节点',
      rationale: '证据不足',
      status: 'pending',
      params: undefined,
    });
  });

  it('maps rewrite query params', async () => {
    const p = proposalFromStructureToolCall({
      toolName: 'propose_rewrite_query',
      toolCallId: 'tc2',
      args: { query: '新查询', title: 'T' },
    });
    expect(p?.kind).toBe('rewrite_query');
    expect(p?.params).toEqual({ query: '新查询', title: 'T' });
  });

  it('returns null for work tools', async () => {
    expect(proposalFromStructureToolCall({ toolName: 'webSearch' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// r91 — work_unit / node_chat 工具集复用共享 fetchPageTool
// ---------------------------------------------------------------------------

interface PrepareCallResult {
  tools: Record<string, { __from?: string; execute?: unknown } | undefined>;
  activeTools?: string[];
}

describe('r91: agent work tools reuse the shared fetchPage extractor', () => {
  it('work_unit tool bag carries the shared fetch-page module marker', async () => {
    const agent = await createResearchNodeAgent(notebookId);
    expect(agent).not.toBeNull();
    const settings = S.__naAgentSettings as {
      prepareCall: (args: { options: Record<string, unknown> }) => PrepareCallResult;
    };

    const baseOptions = {
      role: 'research',
      nodeId: 'n1',
      nodeTitle: '节点',
      useNotebookSources: false,
    };

    const call = settings.prepareCall({
      options: { ...baseOptions, mode: 'work_unit', allowWeb: true },
    });

    // fetchPage 在工具袋中，且就是共享 ai/tools/fetch-page.ts 的产物
    //（标记穿透 wrapToolIoOutsideLlmLock 的 spread 包装）。
    expect(call.tools.fetchPage).toBeDefined();
    expect(call.tools.fetchPage?.__from).toBe('shared-extractor-chain');
    expect(typeof call.tools.fetchPage?.execute).toBe('function');
    expect(call.activeTools).toContain('webSearch');
    expect(call.activeTools).toContain('fetchPage');

    // node_chat 在 allowWeb=true 时同样暴露 fetchPage。
    const chatCall = settings.prepareCall({
      options: { ...baseOptions, mode: 'node_chat', allowWeb: true },
    });
    expect(chatCall.activeTools).toContain('fetchPage');

    // allowWeb=false 时不装配 fetchPage（不暴露外网读页面）。
    const offCall = settings.prepareCall({
      options: { ...baseOptions, mode: 'work_unit', allowWeb: false },
    });
    expect(offCall.tools.fetchPage).toBeUndefined();
    expect(offCall.activeTools).not.toContain('fetchPage');
  });
});

// ---------------------------------------------------------------------------
// r86 — 节点短综合彻底失败 → missing；空证据合法；Run 不因此 failed
// ---------------------------------------------------------------------------

function nodeById(nodes: Array<{ id: string }>, id: string) {
  const node = nodes.find((n) => n.id === id);
  expect(node).toBeDefined();
  return node!;
}

describe('r86: total node-model failure marks missing and the run continues', () => {
  it('empty-SERP branch writes honest summary; failed branch marks missing; run stays non-failed', async () => {
    const graph = {
      nodes: [
        { id: 'node_root_q', role: 'question', title: '问题', conclusionStatus: 'partial' },
        { id: 'node_conclusion_1', role: 'conclusion', title: '结论', conclusionStatus: 'pending' },
        {
          id: 'n_empty',
          role: 'research',
          title: '空证据支路',
          query: '空检索',
          conclusionStatus: 'pending',
          evidenceIds: [],
        },
        {
          id: 'n_fail',
          role: 'research',
          title: '失败支路',
          query: '失败检索',
          conclusionStatus: 'pending',
          evidenceIds: [],
        },
      ],
      edges: [
        { id: 'e1', source: 'node_root_q', target: 'n_empty', kind: 'decompose' },
        { id: 'e2', source: 'node_root_q', target: 'n_fail', kind: 'decompose' },
        { id: 'm1', source: 'n_empty', target: 'node_conclusion_1', kind: 'merge' },
        { id: 'm2', source: 'n_fail', target: 'node_conclusion_1', kind: 'merge' },
      ],
    };
    const runId = getOrm()
      .insert(researchRuns)
      .values({
        notebookId,
        topic: 'r86 node missing continues',
        status: 'running',
        useNotebookSources: false,
        allowWeb: true,
        depth: 'shallow',
        maxSearches: 5,
        maxNodes: 10,
        searchesUsed: 0,
        maxPageFetches: 5,
        pagesUsed: 0,
        graph,
      })
      .returning()
      .get().id;

    await drainResearchWorkUnits(runId, ensureRunAbortController(runId).signal);

    const row = getOrm().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
    // 彻底失败的支路不把整 Run 拖进 failed。
    expect(row).toBeDefined();
    const runRow = row!;
    expect(runRow.status).toBe('running');

    const graphRow = (runRow.graph ?? {}) as {
      nodes?: Array<{ id: string; conclusionStatus?: string; summary?: string }>;
    };
    const nodes = graphRow.nodes ?? [];
    const empty = nodeById(nodes, 'n_empty');
    const fail = nodeById(nodes, 'n_fail');

    // 空证据列表合法：摘要如实写回（无 pragmatic 假命中）。
    expect(empty.conclusionStatus).toBe('missing');
    expect(empty.summary).toBe('空证据支路短综合：检索无命中，如实说明。');
    // 彻底失败的节点标记 conclusionStatus=missing。
    expect(fail.conclusionStatus).toBe('missing');
    expect(fail.summary).toBe('综合失败');

    // 无假命中：证据库保持为空；唯一 searchesUsed 增量来自那次空 SERP 检索。
    expect(await listEvidences(runId)).toHaveLength(0);
    expect(runRow.searchesUsed).toBe(1);
  });
});
