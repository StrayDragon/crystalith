// covers: r98（deep-research-runtime）——预算触顶 finish_report 出稿：pending 支路标 missing、结案携带「预算用尽·部分完成」披露与未覆盖主题清单、已有证据仍进综合目录；全部覆盖时不注入披露。
// 披露机制是 prompt 驱动（report.ts buildPartialCompletionPromptHint 未导出），
// 故用 recording mock 捕获结案 prompt 断言披露指令与未覆盖清单，并让 mock 报告
// 按该提示回写披露段，端到端锁住「权威报告明示部分完成」。
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

mock.module('../../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => [],
  webSearchTool: () => ({}),
}));

const synthesizePrompts: string[] = [];

// 模型侧替身：结案 prompt 带「未覆盖主题：」时回写披露段（遵循产品披露指令）。
function mockReportFromPrompt(prompt: string) {
  const uncovered = /未覆盖主题：(.+)/u.exec(prompt)?.[1];
  return {
    title: '研究报告：mock 结案',
    sections: [
      {
        id: 'overview',
        heading: '概述',
        blocks: [
          {
            type: 'paragraph',
            text: uncovered
              ? `预算用尽·部分完成——未覆盖主题：${uncovered}`
              : '全部支路已完成覆盖。',
            citeIds: [],
          },
        ],
      },
    ],
    citations: {},
  };
}

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async ({ prompt }: { prompt?: string }) => {
    const p = prompt ?? '';
    if (/深度研究结案写作者/u.test(p)) {
      synthesizePrompts.push(p);
      return { object: mockReportFromPrompt(p) };
    }
    return { object: { branches: [] } };
  },
  generateText: async ({ prompt }: { prompt?: string }) => ({
    text: JSON.stringify(mockReportFromPrompt(prompt ?? '')),
  }),
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {
      yield 'mock';
    })(),
  }),
  tool: (def: unknown) => def,
  ToolLoopAgent: class {
    async stream() {
      const make = async function* () {};
      return {
        stream: make(),
        fullStream: make(),
        textStream: (async function* () {
          yield 'mock';
        })(),
      };
    }
  },
  isStepCount: () => ({ kind: 'stepCount' }),
}));

import { notebooks, researchRuns } from '../../src/db/schema.ts';
import { confirmRun } from '../../src/features/research/commands.ts';
import { insertEvidence } from '../../src/features/research/research-core.ts';
import {
  getOrm,
  seedChatModel,
  setupIntegrationEnv,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

let notebookId: number;
let runSeq = 0;

beforeAll(() => {
  setupIntegrationEnv();
  seedChatModel();
  notebookId = getOrm()
    .insert(notebooks)
    .values({ name: 'report-unfinished-r98' })
    .returning()
    .get().id;
});

afterAll(teardownIntegrationEnv);

interface SeedGraphInput {
  withPending: boolean;
}

function seedBudgetTippedRun(opts: SeedGraphInput): { runId: number; evId: string } {
  runSeq += 1;
  const evId = `ev_r98_done_${runSeq}`;
  const nodes: Array<Record<string, unknown>> = [
    { id: 'node_root_q', role: 'question', title: '问题', conclusionStatus: 'clear' },
    { id: 'node_conclusion_1', role: 'conclusion', title: '结论', conclusionStatus: 'pending' },
    {
      id: 'n_done',
      role: 'research',
      title: '已覆盖支路',
      conclusionStatus: 'partial',
      evidenceIds: [evId],
      summary: '已有证据综合',
    },
  ];
  const edges: Array<Record<string, unknown>> = [
    { id: 'e1', source: 'node_root_q', target: 'n_done', kind: 'decompose' },
    { id: 'm1', source: 'n_done', target: 'node_conclusion_1', kind: 'merge' },
  ];
  if (opts.withPending) {
    nodes.push({
      id: 'n_pending',
      role: 'research',
      title: '未覆盖支路甲',
      conclusionStatus: 'pending',
      evidenceIds: [],
    });
    edges.push({ id: 'e2', source: 'node_root_q', target: 'n_pending', kind: 'decompose' });
    edges.push({ id: 'm2', source: 'n_pending', target: 'node_conclusion_1', kind: 'merge' });
  }
  const runId = getOrm()
    .insert(researchRuns)
    .values({
      notebookId,
      topic: `r98 finish report ${runSeq}`,
      status: 'awaiting_confirm',
      confirmKind: 'budget',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'shallow',
      maxSearches: 20,
      maxNodes: 24,
      searchesUsed: 20,
      maxPageFetches: 30,
      pagesUsed: 0,
      llmActivity: null,
      graph: { nodes, edges },
    })
    .returning()
    .get().id;
  return { runId, evId };
}

async function seedEvidence(runId: number, evId: string): Promise<void> {
  await insertEvidence(runId, notebookId, {
    id: evId,
    kind: 'web',
    title: '已有证据',
    snippet: '已有证据摘要',
    url: 'https://example.com/r98',
    collectedAtNodeId: 'n_done',
  });
}

describe('r98: partial-completion honesty on budget-capped finish_report', () => {
  it('discloses 预算用尽 + uncovered topics, marks pending nodes missing, still synthesizes existing evidence', async () => {
    const { runId, evId } = seedBudgetTippedRun({ withPending: true });
    await seedEvidence(runId, evId);

    const run = await confirmRun(notebookId, runId, { action: 'finish_report' });

    // 出稿完成（残缺研究不把 Run 拖进 failed）。
    expect(run.status).toBe('completed');
    expect(run.report).not.toBeNull();

    // 权威报告明示预算用尽与未覆盖主题（部分完成），不包装为完整覆盖。
    const reportText = JSON.stringify(run.report);
    expect(reportText).toContain('预算用尽·部分完成');
    expect(reportText).toContain('未覆盖支路甲');

    // 结案 prompt 携带披露指令与未覆盖主题清单；已有证据仍进综合目录。
    const prompt = synthesizePrompts.at(-1) ?? '';
    expect(prompt).toContain('【预算用尽·部分完成】');
    expect(prompt).toContain('未覆盖主题：未覆盖支路甲');
    expect(prompt).toContain(`id=${evId}`);

    // pending 支路标 conclusionStatus=missing 且摘要明示预算用尽；已覆盖支路不受影响。
    const pendingNode = run.nodes.find((n) => n.id === 'n_pending');
    expect(pendingNode?.conclusionStatus).toBe('missing');
    expect(pendingNode?.summary).toBe('预算用尽，未完成检索');
    const doneNode = run.nodes.find((n) => n.id === 'n_done');
    expect(doneNode?.conclusionStatus).toBe('partial');
    expect(doneNode?.summary).toBe('已有证据综合');
  });

  it('no disclosure hint when every research branch is covered', async () => {
    const { runId, evId } = seedBudgetTippedRun({ withPending: false });
    await seedEvidence(runId, evId);

    const run = await confirmRun(notebookId, runId, { action: 'finish_report' });

    expect(run.status).toBe('completed');
    // 完整覆盖的研究不被报成部分完成。
    expect(JSON.stringify(run.report)).not.toContain('预算用尽·部分完成');
    const prompt = synthesizePrompts.at(-1) ?? '';
    expect(prompt).not.toContain('【预算用尽·部分完成】');
  });
});
