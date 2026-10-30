// covers: r114/r153（deep-research-ui）——剪枝/分叉仅经 POST research/:rid/nodes/:id/prune|fork 命令口并以响应回写；addBudget 经 add-budget 命令口按服务端响应抬高 maxSearches（不本地估算）。
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import * as streamActual from '../../api/stream' with { rstest: 'importActual' };
import { server } from '../../test-utils/msw/server';

// Mock reason: 挂起 Run SSE 事件流 —— 命令口测试只关心 HTTP 响应回写，不消费真实 SSE。
rs.mock('../../api/stream', () => ({
  ...streamActual,
  streamRequest: rs.fn(async function* () {
    await new Promise(() => undefined);
    yield undefined as never;
  }),
}));

// Mock reason: 隔离全局 SWR 任务缓存副作用（命令成功后的 refresh 不触发网络）。
rs.mock('./researchTasksCache', () => ({
  refreshResearchTasks: rs.fn(),
}));

import { useEdenLabController } from './useEdenLabController';

const NID = 7114; // 文件内唯一 notebookId，避免全局 SWR 缓存串扰
const RID = 9114;

let pruneCalls = 0;
let forkCalls = 0;
let budgetCalls = 0;
let forkBodies: unknown[] = [];

function mkRun(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: RID,
    notebookId: NID,
    topic: '拓扑绝缘体综述',
    status: 'running',
    useNotebookSources: false,
    allowWeb: true,
    depth: 'medium',
    maxSearches: 50,
    maxNodes: 60,
    searchesUsed: 3,
    maxPageFetches: 75,
    pagesUsed: 0,
    nodes: [
      { id: 'node_root_1', title: '主问题', role: 'question', conclusionStatus: 'pending' },
      {
        id: 'node_research_a',
        title: '支路A',
        role: 'research',
        conclusionStatus: 'pending',
        evidenceIds: [],
      },
      { id: 'node_conclusion_1', title: '结论', role: 'conclusion', conclusionStatus: 'pending' },
    ],
    edges: [
      { id: 'e_root_a', source: 'node_root_1', target: 'node_research_a', kind: 'expand' },
      {
        id: 'e_a_conc',
        source: 'node_research_a',
        target: 'node_conclusion_1',
        kind: 'merge',
        labelNote: '汇入',
      },
    ],
    evidences: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Prune response: server marks node_research_a pruned (r113 fade semantics upstream). */
function prunedRun(): Record<string, unknown> {
  const run = mkRun();
  const nodes = run.nodes as { id: string; conclusionStatus: string }[];
  nodes.find((n) => n.id === 'node_research_a')!.conclusionStatus = 'pruned';
  return run;
}

/** Fork response: server appends a sibling research node + edge. */
function forkedRun(): Record<string, unknown> {
  const run = mkRun();
  (run.nodes as unknown[]).push({
    id: 'node_research_a2',
    title: '对照：支路A',
    role: 'research',
    conclusionStatus: 'pending',
    evidenceIds: [],
  });
  (run.edges as unknown[]).push({
    id: 'e_root_a2',
    source: 'node_root_1',
    target: 'node_research_a2',
    kind: 'expand',
  });
  return run;
}

function useRunAndCommandHandlers(run: Record<string, unknown>) {
  server.use(
    http.get(`*/v2/notebooks/${NID}/research/${RID}`, () => HttpResponse.json(run)),
    http.get(`*/v2/notebooks/${NID}/research/${RID}/progress`, () =>
      HttpResponse.json({ items: [], nextAfterSeq: 0 }),
    ),
    http.get(`*/v2/notebooks/${NID}/research`, () =>
      HttpResponse.json({ items: [], total: 0, offset: 0, limit: 50 }),
    ),
    http.post(`*/v2/notebooks/${NID}/research/${RID}/nodes/node_research_a/prune`, () => {
      pruneCalls += 1;
      return HttpResponse.json(prunedRun());
    }),
    http.post(
      `*/v2/notebooks/${NID}/research/${RID}/nodes/node_research_a/fork`,
      async ({ request }) => {
        forkCalls += 1;
        forkBodies.push(await request.json());
        return HttpResponse.json(forkedRun());
      },
    ),
    http.post(`*/v2/notebooks/${NID}/research/${RID}/add-budget`, () => {
      budgetCalls += 1;
      return HttpResponse.json(mkRun({ maxSearches: 100, searchesUsed: 50 }));
    }),
  );
}

describe('useEdenLabController graph command ports (r114/r153)', () => {
  beforeEach(() => {
    pruneCalls = 0;
    forkCalls = 0;
    budgetCalls = 0;
    forkBodies = [];
  });

  it('pruneAlongEdge POSTs …/nodes/:id/prune once and writes back the server graph (r114)', async () => {
    useRunAndCommandHandlers(mkRun());
    const { result } = renderHook(() => useEdenLabController(NID, RID));
    await waitFor(() => {
      expect(result.current.runStatus).toBe('running');
    });
    expect(
      result.current.derived.nodes.find((n) => n.id === 'node_research_a')?.conclusionStatus,
    ).toBe('pending');

    act(() => {
      result.current.pruneAlongEdge('e_root_a');
    });

    // 剪枝仅发往对应命令口，恰好一次。
    await waitFor(() => {
      expect(pruneCalls).toBe(1);
    });
    // 命令响应到达后以服务端结果回写（pruned 来自响应图，非本地预览转正）。
    await waitFor(() => {
      expect(
        result.current.derived.nodes.find((n) => n.id === 'node_research_a')?.conclusionStatus,
      ).toBe('pruned');
    });
    expect(forkCalls).toBe(0);
  });

  it('forkAlongEdge POSTs …/nodes/:id/fork with hint and writes back the server graph (r114)', async () => {
    useRunAndCommandHandlers(mkRun());
    const { result } = renderHook(() => useEdenLabController(NID, RID));
    await waitFor(() => {
      expect(result.current.runStatus).toBe('running');
    });

    act(() => {
      result.current.forkAlongEdge('e_root_a', {
        title: '对照：支路A',
        query: 'alternate query',
        summary: '',
      });
    });

    await waitFor(() => {
      expect(forkCalls).toBe(1);
    });
    // fork 可带可选 hint（draft 字段拼接），经命令口 body 传递。
    expect(forkBodies[0]).toMatchObject({ hint: expect.stringContaining('对照：支路A') });
    // 服务端结果回写：新增分叉节点来自响应图。
    await waitFor(() => {
      expect(result.current.derived.nodes.some((n) => n.id === 'node_research_a2')).toBe(true);
    });
    expect(pruneCalls).toBe(0);
  });

  it('addBudget from running POSTs add-budget and raises maxSearches from the response (r153)', async () => {
    useRunAndCommandHandlers(mkRun());
    const { result } = renderHook(() => useEdenLabController(NID, RID));
    await waitFor(() => {
      expect(result.current.runStatus).toBe('running');
    });
    expect(result.current.maxSearches).toBe(50);

    act(() => {
      result.current.addBudget();
    });

    await waitFor(() => {
      expect(budgetCalls).toBe(1);
    });
    // 加购经 add-budget 命令口按服务端公式抬高 maxSearches（100 来自响应而非本地估算）。
    await waitFor(() => {
      expect(result.current.maxSearches).toBe(100);
    });
  });

  it('addBudget from awaiting_confirm(budget) hits the same add-budget command port (r153)', async () => {
    useRunAndCommandHandlers(mkRun({ status: 'awaiting_confirm', confirmKind: 'budget' }));
    // 后注册的 handler 优先：本用例专属的 add-budget 响应覆盖通用集合。
    server.use(
      http.post(`*/v2/notebooks/${NID}/research/${RID}/add-budget`, () => {
        budgetCalls += 1;
        return HttpResponse.json(
          mkRun({
            status: 'awaiting_confirm',
            confirmKind: 'budget',
            maxSearches: 80,
            searchesUsed: 50,
          }),
        );
      }),
    );
    const { result } = renderHook(() => useEdenLabController(NID, RID));
    await waitFor(() => {
      expect(result.current.runStatus).toBe('awaiting_confirm');
    });
    // 前置态：awaiting_confirm 且 confirmKind=budget。
    expect(result.current.confirmKind).toBe('budget');
    expect(result.current.maxSearches).toBe(50);

    act(() => {
      result.current.addBudget();
    });

    await waitFor(() => {
      expect(budgetCalls).toBe(1);
    });
    await waitFor(() => {
      expect(result.current.maxSearches).toBe(80);
    });
  });
});
