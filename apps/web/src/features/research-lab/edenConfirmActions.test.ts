import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const confirmResearchRun = vi.hoisted(() => vi.fn());
const createResearchRun = vi.hoisted(() => vi.fn());
const getResearchRun = vi.hoisted(() => vi.fn());

const expandRun = vi.hoisted(() => ({
  id: 7,
  notebookId: 1,
  topic: 't',
  status: 'awaiting_confirm' as const,
  useNotebookSources: false,
  allowWeb: true,
  depth: 'medium' as const,
  maxSearches: 20,
  maxNodes: 30,
  searchesUsed: 2,
  nodes: [],
  edges: [],
  evidences: [],
  confirmKind: 'expand_branch' as const,
  confirmBranchNodeId: 'node_x',
  createdAt: '2026-07-24T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
}));

// Mock reason: assert skip/approve confirm bodies without HTTP.
vi.mock('./edenResearchApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./edenResearchApi')>();
  return {
    ...actual,
    confirmResearchRun: (...args: unknown[]) => confirmResearchRun(...args),
    createResearchRun: (...args: unknown[]) => createResearchRun(...args),
    getResearchRun: (...args: unknown[]) => getResearchRun(...args),
    listProgress: vi.fn(async () => ({ items: [] })),
  };
});

// Mock reason: no live SSE in confirm action unit tests.
vi.mock('../../api/stream', () => ({
  streamRequest: vi.fn(async function* () {
    /* empty */
  }),
}));

// Mock reason: avoid task-cache side effects.
vi.mock('./researchTasksCache', () => ({
  refreshResearchTasks: vi.fn(),
}));

import { useEdenLabController } from './useEdenLabController';

describe('eden confirm actions (c96)', () => {
  beforeEach(() => {
    confirmResearchRun.mockReset();
    createResearchRun.mockReset();
    getResearchRun.mockReset();
    confirmResearchRun.mockResolvedValue({
      ...expandRun,
      status: 'running',
      confirmKind: null,
      confirmBranchNodeId: null,
    });
    createResearchRun.mockResolvedValue({ ...expandRun });
    getResearchRun.mockResolvedValue({ ...expandRun });
  });

  it('skipBranch posts skip_branch with branchNodeId', async () => {
    const { result } = renderHook(() => useEdenLabController(1, null));

    await act(async () => {
      result.current.composeAndStart('topic');
    });
    await waitFor(() => expect(result.current.confirmBranchNodeId).toBe('node_x'));

    await act(async () => {
      result.current.skipBranch();
    });
    await waitFor(() => expect(confirmResearchRun).toHaveBeenCalled());
    expect(confirmResearchRun).toHaveBeenCalledWith(1, 7, {
      action: 'skip_branch',
      branchNodeId: 'node_x',
    });
  });

  it('approveBranch posts approve_branch with branchNodeId', async () => {
    const { result } = renderHook(() => useEdenLabController(1, null));

    await act(async () => {
      result.current.composeAndStart('topic');
    });
    await waitFor(() => expect(result.current.confirmBranchNodeId).toBe('node_x'));

    await act(async () => {
      result.current.approveBranch();
    });
    await waitFor(() => expect(confirmResearchRun).toHaveBeenCalled());
    expect(confirmResearchRun).toHaveBeenCalledWith(1, 7, {
      action: 'approve_branch',
      branchNodeId: 'node_x',
    });
  });
});
