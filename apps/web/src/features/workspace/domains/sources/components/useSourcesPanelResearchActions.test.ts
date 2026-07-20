import { act } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { renderHook } from '../../../../../test-utils/renderHook';
import type { Research } from './sources-panel-types';
import { useSourcesPanelResearchActions } from './useSourcesPanelResearchActions';

function makeResearch(overrides: Partial<Research> = {}): Research {
  return {
    sessions: [],
    activeSession: {
      id: 42,
      notebookId: 1,
      topic: 'Topic',
      status: 'waiting_user',
      currentIteration: 2,
      maxIterations: 4,
      aggregatedResults: null,
      finalReport: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    isLoading: false,
    error: '',
    sseEvents: [],
    fetchSessions: vi.fn(),
    fetchSession: vi.fn().mockResolvedValue(null),
    createSession: vi.fn().mockResolvedValue(null),
    deleteSession: vi.fn(),
    startResearch: vi.fn(),
    approveSearchPlan: vi.fn().mockResolvedValue(undefined),
    modifySearchPlan: vi.fn().mockResolvedValue(undefined),
    skipIteration: vi.fn(),
    finishResearch: vi.fn(),
    cancelResearch: vi.fn(),
    resumeResearch: vi.fn().mockResolvedValue(null),
    subscribeToSSE: vi.fn(),
    unsubscribeFromSSE: vi.fn(),
    clearEvents: vi.fn(),
    setActiveSession: vi.fn(),
    ...overrides,
  } as Research;
}

test('handleResearchApprove with allSelected calls approveSearchPlan only', async () => {
  const research = makeResearch();
  const { result } = renderHook(() => useSourcesPanelResearchActions({ research }));

  await act(async () => {
    await result.current.handleResearchApprove({
      allSelected: true,
      queries: [{ query: 'q1', engine: 'Web', priority: 1, reason: 'r' }],
      reasoning: 'full plan',
    });
  });

  expect(research.approveSearchPlan).toHaveBeenCalledWith(42);
  expect(research.modifySearchPlan).not.toHaveBeenCalled();
});

test('handleResearchApprove with subset calls modifySearchPlan with filtered plan', async () => {
  const research = makeResearch();
  const queries = [{ query: 'kept', engine: 'Web', priority: 1, reason: 'subset' }];
  const { result } = renderHook(() => useSourcesPanelResearchActions({ research }));

  await act(async () => {
    await result.current.handleResearchApprove({
      allSelected: false,
      queries,
      reasoning: 'trimmed',
    });
  });

  expect(research.modifySearchPlan).toHaveBeenCalledWith(42, {
    iteration: 2,
    queries,
    reasoning: 'trimmed',
    estimatedResults: 10,
  });
  expect(research.approveSearchPlan).not.toHaveBeenCalled();
});

test('handleResearchApprove without activeSession calls neither approve nor modify', async () => {
  const research = makeResearch({ activeSession: null });
  const { result } = renderHook(() => useSourcesPanelResearchActions({ research }));

  await act(async () => {
    await result.current.handleResearchApprove({
      allSelected: true,
      queries: [],
      reasoning: '',
    });
  });

  expect(research.approveSearchPlan).not.toHaveBeenCalled();
  expect(research.modifySearchPlan).not.toHaveBeenCalled();
});
