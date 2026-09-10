import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { act, waitFor } from '@testing-library/react';

import * as edenResearchApiActual from './edenResearchApi' with { rstest: 'importActual' };

const callOrder = rs.hoisted(() => [] as string[]);
const cancelActiveEdenRun = rs.hoisted(() =>
  rs.fn(async () => {
    callOrder.push('cancelActiveEdenRun');
    return {
      id: 9,
      notebookId: 62,
      topic: 't',
      status: 'cancelled' as const,
      useNotebookSources: false,
      allowWeb: true,
      depth: 'medium' as const,
      maxSearches: 40,
      maxNodes: 60,
      searchesUsed: 0,
      nodes: [],
      edges: [],
      evidences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }),
);
const createResearchRun = rs.hoisted(() =>
  rs.fn(async () => ({
    id: 9,
    notebookId: 62,
    topic: 't',
    status: 'queued' as const,
    useNotebookSources: false,
    allowWeb: true,
    depth: 'medium' as const,
    maxSearches: 40,
    maxNodes: 60,
    searchesUsed: 0,
    nodes: [],
    edges: [],
    evidences: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
);

// Mock reason: isolate cancel ordering without live SSE.
rs.mock('../../api/stream', () => ({
  streamRequest: rs.fn(async function* () {
    await new Promise(() => undefined);
    yield undefined as never;
  }),
}));

// Mock reason: assert stopStream-before-cancel without HTTP.
rs.mock('./edenCancelFlow', () => ({
  cancelActiveEdenRun,
}));

rs.mock('./edenResearchApi', () => {
  return {
    ...edenResearchApiActual,
    createResearchRun,
    listProgress: rs.fn(async () => ({ items: [], nextAfterSeq: 0 })),
    getResearchRun: rs.fn(async (_nid: number, rid: number) => ({
      id: rid,
      notebookId: 62,
      topic: 't',
      status: 'queued',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'medium',
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

rs.mock('./researchTasksCache', () => ({
  refreshResearchTasks: rs.fn(),
}));

import { renderHook } from '@testing-library/react';

import { useEdenLabController } from './useEdenLabController';

describe('useEdenLabController cancel SSE order', () => {
  beforeEach(() => {
    callOrder.length = 0;
    cancelActiveEdenRun.mockClear();
    createResearchRun.mockClear();
  });

  it('aborts SSE before cancelActiveEdenRun POST', async () => {
    const { result } = renderHook(() => useEdenLabController(62));

    act(() => {
      result.current.setTopicDraft('t');
      result.current.composeAndStart('t');
    });

    await waitFor(() => {
      expect(result.current.runId).toBe(9);
    });
    expect(result.current.runStatus).toBe('queued');

    callOrder.length = 0;
    const origAbort = AbortController.prototype.abort;
    const abortSpy = rs.spyOn(AbortController.prototype, 'abort').mockImplementation(function (
      this: AbortController,
      reason?: unknown,
    ) {
      callOrder.push('stopStream');
      return origAbort.call(this, reason);
    });

    try {
      act(() => {
        result.current.cancel();
      });

      await waitFor(() => {
        expect(cancelActiveEdenRun).toHaveBeenCalledWith(62, 9);
      });

      const stopIdx = callOrder.indexOf('stopStream');
      const cancelIdx = callOrder.indexOf('cancelActiveEdenRun');
      expect(stopIdx).toBeGreaterThanOrEqual(0);
      expect(cancelIdx).toBeGreaterThan(stopIdx);
    } finally {
      abortSpy.mockRestore();
    }
  });
});
