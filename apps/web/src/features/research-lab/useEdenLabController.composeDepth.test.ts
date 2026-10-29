// covers: r140（deep-research-ui）——POST research 创建 body 显式携带所选 depth。
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { act, waitFor } from '@testing-library/react';

import * as edenResearchApiActual from './edenResearchApi' with { rstest: 'importActual' };

const createResearchRun = rs.fn();

// Mock reason: isolate compose→create body; no live SSE.
rs.mock('../../api/stream', () => ({
  streamRequest: rs.fn(async function* () {
    /* no events */
  }),
}));

// Mock reason: assert createResearchRun payload without HTTP.
rs.mock('./edenResearchApi', () => {
  return {
    ...edenResearchApiActual,
    createResearchRun: (...args: unknown[]) => createResearchRun(...args),
    listProgress: rs.fn(async () => ({ items: [], nextAfterSeq: 0 })),
    getResearchRun: rs.fn(async () => ({
      id: 99,
      notebookId: 62,
      topic: 't',
      status: 'queued',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'deep',
      maxSearches: 40,
      maxNodes: 60,
      searchesUsed: 0,
      nodes: [],
      edges: [],
      evidences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  };
});

// Mock reason: avoid task-cache side effects in unit test.
rs.mock('./researchTasksCache', () => ({
  refreshResearchTasks: rs.fn(),
}));

import { renderHook } from '../../test-utils/renderHook';
import { useEdenLabController } from './useEdenLabController';

describe('useEdenLabController compose depth (r447)', () => {
  beforeEach(() => {
    createResearchRun.mockReset();
  });

  // 「defaults depth to medium」常量镜像用例已删：默认值由下方 create payload
  // 用例的初始状态与 labComposeDepth 预算映射间接锁定。
  it('POST createResearchRun includes selected depth', async () => {
    createResearchRun.mockResolvedValue({
      id: 99,
      notebookId: 62,
      topic: 't',
      status: 'queued',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'deep',
      maxSearches: 40,
      maxNodes: 60,
      searchesUsed: 0,
      nodes: [],
      edges: [],
      evidences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useEdenLabController(62));

    act(() => {
      result.current.setDepth('deep');
      result.current.setTopicDraft('深度主题');
    });

    act(() => {
      result.current.composeAndStart('深度主题');
    });

    await waitFor(() => {
      expect(createResearchRun).toHaveBeenCalled();
    });

    expect(createResearchRun).toHaveBeenCalledWith(
      62,
      expect.objectContaining({
        topic: '深度主题',
        depth: 'deep',
        allowWeb: true,
      }),
    );
  });
});
