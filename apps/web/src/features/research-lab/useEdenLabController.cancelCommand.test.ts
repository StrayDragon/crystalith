// covers: r449（deep-research-ui）——顶栏取消经 POST research/:rid/cancel 命令口执行且 runStatus 变 cancelled。
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '../../test-utils/msw/server';
import * as edenResearchApiActual from './edenResearchApi' with { rstest: 'importActual' };

const NID = 7331; // 文件内唯一 notebookId
const RID = 88;

let cancelCalls = 0;

function runFixture(status: string) {
  return {
    id: RID,
    notebookId: NID,
    topic: '可控核聚变进展',
    status,
    useNotebookSources: false,
    allowWeb: true,
    depth: 'medium',
    maxSearches: 50,
    maxNodes: 60,
    searchesUsed: 3,
    nodes: [],
    edges: [],
    evidences: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Mock reason: 隔离取消命令口断言，不让真实 SSE 事件流干扰终态回写。
rs.mock('../../api/stream', () => ({
  streamRequest: rs.fn(async function* () {
    await new Promise(() => undefined);
    yield undefined as never;
  }),
  streamWithReconnect: rs.fn(async function* () {
    await new Promise(() => undefined);
    yield undefined as never;
  }),
}));

// Mock reason: 固定 GET Run 为 running；保留真实 cancelResearchRun 走 MSW 断言命令口。
rs.mock('./edenResearchApi', () => {
  return {
    ...edenResearchApiActual,
    getResearchRun: rs.fn(async () => runFixture('running')),
    listProgress: rs.fn(async () => ({ items: [], nextAfterSeq: 0 })),
  };
});

// Mock reason: 单测未挂载任务列表，去掉 SWR 全局 mutate 副作用。
rs.mock('./researchTasksCache', () => ({
  refreshResearchTasks: rs.fn(),
}));

import { renderHook } from '../../test-utils/renderHook';
import { useEdenLabController } from './useEdenLabController';

describe('useEdenLabController cancel command port (r449)', () => {
  beforeEach(() => {
    cancelCalls = 0;
    server.use(
      http.post(`*/v2/notebooks/${NID}/research/${RID}/cancel`, () => {
        cancelCalls += 1;
        return HttpResponse.json(runFixture('cancelled'));
      }),
    );
  });

  it('cancel posts …/research/:rid/cancel and runStatus becomes cancelled', async () => {
    const { result } = renderHook(() => useEdenLabController(NID, RID));

    // 初始加载权威 Run：status = running（顶栏取消入口的前置态）。
    await waitFor(() => {
      expect(result.current.runStatus).toBe('running');
    });

    act(() => {
      result.current.cancel();
    });

    // 取消经命令口 POST …/research/:rid/cancel 执行（恰好一次）。
    await waitFor(() => {
      expect(cancelCalls).toBe(1);
    });

    // 命令响应回写后 Run 终态为 cancelled。
    await waitFor(() => {
      expect(result.current.runStatus).toBe('cancelled');
    });
    expect(result.current.runId).toBe(RID);
  });
});
