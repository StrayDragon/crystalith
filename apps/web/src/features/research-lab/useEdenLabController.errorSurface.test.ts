// covers: r110（deep-research-ui）——RESEARCH_BUDGET / RESEARCH_INVALID_STATE 信封错误映射为带错误码的用户可见内联错误并写入活动日志，不静默吞掉。
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import * as streamActual from '../../api/stream' with { rstest: 'importActual' };
import { server } from '../../test-utils/msw/server';

// Mock reason: 挂起 Run SSE 事件流 —— 错误面测试只关心 HTTP 命令口响应，不消费真实 SSE。
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

const NID = 7110; // 文件内唯一的 notebookId，避免全局 SWR 缓存串扰
const RID = 9110;

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

describe('useEdenLabController research error surfacing (r110)', () => {
  beforeEach(() => {
    server.use(
      http.get(`*/v2/notebooks/${NID}/research/${RID}`, () => HttpResponse.json(mkRun())),
      http.get(`*/v2/notebooks/${NID}/research/${RID}/progress`, () =>
        HttpResponse.json({ items: [], nextAfterSeq: 0 }),
      ),
      http.get(`*/v2/notebooks/${NID}/research`, () =>
        HttpResponse.json({ items: [], total: 0, offset: 0, limit: 50 }),
      ),
      http.post(`*/v2/notebooks/${NID}/research/${RID}/add-budget`, () =>
        HttpResponse.json(
          { errorCode: 'RESEARCH_BUDGET', message: '检索预算已用尽，可加购继续' },
          { status: 422 },
        ),
      ),
      http.post(`*/v2/notebooks/${NID}/research/${RID}/confirm`, () =>
        HttpResponse.json(
          { errorCode: 'RESEARCH_INVALID_STATE', message: '当前 Run 状态不允许该操作' },
          { status: 422 },
        ),
      ),
    );
  });

  it('maps RESEARCH_BUDGET envelope to a code-prefixed inline error and logs it', async () => {
    const { result } = renderHook(() => useEdenLabController(NID, RID));
    await waitFor(() => {
      expect(result.current.runStatus).toBe('running');
    });
    expect(result.current.lastError).toBe('');

    act(() => {
      result.current.addBudget();
    });

    const expected = '[RESEARCH_BUDGET] 检索预算已用尽，可加购继续';
    await waitFor(() => {
      expect(result.current.lastError).toBe(expected);
    });
    // 专用错误码不被静默吞掉：内联错误之外同步落到活动日志。
    expect(result.current.mutations.activityNotes).toContain(expected);
    expect(result.current.busy).toBe(false);
  });

  it('maps RESEARCH_INVALID_STATE envelope distinctly (not collapsed to generic copy)', async () => {
    const { result } = renderHook(() => useEdenLabController(NID, RID));
    await waitFor(() => {
      expect(result.current.runStatus).toBe('running');
    });

    act(() => {
      result.current.finishReport();
    });

    const expected = '[RESEARCH_INVALID_STATE] 当前 Run 状态不允许该操作';
    await waitFor(() => {
      expect(result.current.lastError).toBe(expected);
    });
    expect(result.current.mutations.activityNotes).toContain(expected);
    // 两码各自呈现，未退化为通用「请求失败」文案。
    expect(result.current.lastError).not.toContain('请求失败');
  });

  it('error is transient — a subsequent successful command clears it with server state', async () => {
    const { result } = renderHook(() => useEdenLabController(NID, RID));
    await waitFor(() => {
      expect(result.current.runStatus).toBe('running');
    });

    act(() => {
      result.current.addBudget();
    });
    await waitFor(() => {
      expect(result.current.lastError).toBe('[RESEARCH_BUDGET] 检索预算已用尽，可加购继续');
    });

    server.use(
      http.post(`*/v2/notebooks/${NID}/research/${RID}/add-budget`, () =>
        HttpResponse.json(mkRun({ status: 'running', maxSearches: 100, searchesUsed: 50 })),
      ),
    );

    act(() => {
      result.current.addBudget();
    });
    // 等成功响应真正落地再断言清除：成功备注只在命令响应回写后写入活动日志
    // （命令发起时同步置空的 lastError 不能作为「错误已清除」的证据）。
    await waitFor(() => {
      expect(result.current.mutations.activityNotes).toContain('增加检索预算');
    });
    expect(result.current.lastError).toBe('');
    expect(result.current.busy).toBe(false);
  });
});
