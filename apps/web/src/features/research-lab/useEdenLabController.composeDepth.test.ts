import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createResearchRun = vi.fn();

vi.mock('../../api/stream', () => ({
  streamRequest: vi.fn(async function* () {
    /* no events */
  }),
}));

vi.mock('./edenResearchApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./edenResearchApi')>();
  return {
    ...actual,
    createResearchRun: (...args: unknown[]) => createResearchRun(...args),
    getResearchRun: vi.fn(async () => ({
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

vi.mock('./researchTasksCache', () => ({
  refreshResearchTasks: vi.fn(),
}));

import { renderHook } from '../../test-utils/renderHook';
import { useEdenLabController } from './useEdenLabController';

describe('useEdenLabController compose depth (r447)', () => {
  beforeEach(() => {
    createResearchRun.mockReset();
  });

  it('defaults depth to medium', () => {
    const { result } = renderHook(() => useEdenLabController(62));
    expect(result.current.depth).toBe('medium');
  });

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
