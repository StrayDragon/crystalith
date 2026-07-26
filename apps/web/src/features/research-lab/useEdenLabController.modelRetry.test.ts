import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createResearchRun = vi.fn();
const retrySynthesizeResearchRun = vi.fn();

// Mock reason: isolate compose/retry without live SSE.
vi.mock('../../api/stream', () => ({
  streamRequest: vi.fn(async function* () {
    /* no events */
  }),
}));

// Mock reason: assert create/retry API payloads without HTTP.
vi.mock('./edenResearchApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./edenResearchApi')>();
  return {
    ...actual,
    createResearchRun: (...args: unknown[]) => createResearchRun(...args),
    retrySynthesizeResearchRun: (...args: unknown[]) => retrySynthesizeResearchRun(...args),
    getResearchRun: vi.fn(async (_nid: number, rid: number) => ({
      id: rid,
      notebookId: 62,
      topic: 't',
      status: 'failed',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'deep',
      maxSearches: 40,
      maxNodes: 60,
      searchesUsed: 0,
      failureReason: 'synthesize_model_error: boom',
      nodes: [],
      edges: [],
      evidences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  };
});

// Mock reason: avoid task-cache side effects in unit test.
vi.mock('./researchTasksCache', () => ({
  refreshResearchTasks: vi.fn(),
}));

import { renderHook } from '@testing-library/react';

import { useEdenLabController } from './useEdenLabController';

describe('useEdenLabController modelId + retry-synthesize (r454)', () => {
  beforeEach(() => {
    createResearchRun.mockReset();
    retrySynthesizeResearchRun.mockReset();
  });

  it('POST createResearchRun includes selected modelId', async () => {
    createResearchRun.mockResolvedValue({
      id: 7,
      notebookId: 62,
      topic: 'quantum',
      status: 'queued',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'medium',
      maxSearches: 20,
      maxNodes: 30,
      searchesUsed: 0,
      modelId: 'my-model',
      nodes: [],
      edges: [],
      evidences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useEdenLabController(62));
    act(() => {
      result.current.setModelId('my-model');
      result.current.setTopicDraft('quantum');
    });
    act(() => {
      result.current.composeAndStart('quantum');
    });

    await waitFor(() => {
      expect(createResearchRun).toHaveBeenCalled();
    });
    expect(createResearchRun).toHaveBeenCalledWith(
      62,
      expect.objectContaining({
        topic: 'quantum',
        modelId: 'my-model',
      }),
    );
  });

  it('retrySynthesize calls API with override modelId', async () => {
    retrySynthesizeResearchRun.mockResolvedValue({
      id: 9,
      notebookId: 62,
      topic: 't',
      status: 'completed',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'medium',
      maxSearches: 20,
      maxNodes: 30,
      searchesUsed: 0,
      modelId: 'retry-model',
      nodes: [],
      edges: [],
      evidences: [],
      report: {
        title: 'ok',
        sections: [],
        citations: {},
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useEdenLabController(62, 9));
    await waitFor(() => {
      expect(result.current.runId).toBe(9);
    });

    act(() => {
      result.current.retrySynthesize('retry-model');
    });

    await waitFor(() => {
      expect(retrySynthesizeResearchRun).toHaveBeenCalled();
    });
    expect(retrySynthesizeResearchRun).toHaveBeenCalledWith(62, 9, {
      modelId: 'retry-model',
    });
  });
});
