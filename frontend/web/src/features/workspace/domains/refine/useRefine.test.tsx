import { act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import useSWR from 'swr';

import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceDispatch, useWorkspaceState, WorkspaceProvider } from '../../app/WorkspaceContext';
import { REFINE_TEMPLATES } from './data/refineTemplates';
import { useRefine } from './useRefine';
import { refineBatch } from '../../shared/api';

vi.mock('swr', () => ({
  default: vi.fn(),
}));

vi.mock('../../shared/hooks/useOutputQueue', () => ({
  useOutputQueue: () => ({
    outputQueueJobs: [],
    enqueueOutputJob: vi.fn(),
    enqueueSlidesJob: vi.fn(),
    hasPendingJobs: () => false,
    outputsLoading: false,
    outputsError: '',
    retryOutputs: vi.fn(),
    deleteOutput: vi.fn(),
    clearOutputs: vi.fn(),
    fetchOutput: vi.fn(),
  }),
}));

vi.mock('../../shared/api', () => ({
  listWorkspaceTools: vi.fn(),
  refineBatch: vi.fn(),
}));

const swrMock = vi.mocked(useSWR);

beforeEach(() => {
  swrMock.mockReturnValue({
    data: { tools: [] },
    error: null,
    isLoading: false,
  });
});

function useRefineHarness() {
  const refine = useRefine();
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  return { refine, state, dispatch };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <WorkspaceProvider>{children}</WorkspaceProvider>
);

test('sets default refine prompt when empty', async () => {
  const { result } = renderHook(() => useRefineHarness(), { wrapper });

  await waitFor(() => {
    expect(result.current.refine.refinePrompt).toBe(REFINE_TEMPLATES[0].prompt);
  });
});

test('onGenerateRefine enqueues job with selected chunk ids', async () => {
  vi.mocked(refineBatch).mockResolvedValue({
    outputs: { paragraph: { paragraph: 'Answer', bullets: [], structured: null } },
    citations: [{ chunk_id: 9, chunk_index: 1, source_name: 'Doc', snippet: 'S' }],
  } as any);

  const { result } = renderHook(() => useRefineHarness(), { wrapper });

  act(() => {
    result.current.dispatch({ type: 'SET_CONNECTION_STATE', payload: 'live' });
    result.current.dispatch({ type: 'SET_ACTIVE_NOTEBOOK', payload: 1 });
    result.current.dispatch({ type: 'SET_REFINE_PROMPT', payload: '提炼核心结论' });
    result.current.dispatch({
      type: 'SET_CITATIONS',
      payload: [
        { id: 'c1', chunkId: 9, sourceTitle: 'Doc', snippet: '', chunkIndex: 1 } as any,
      ],
    });
    result.current.dispatch({
      type: 'SET_SELECTED_CITATIONS',
      payload: { c1: true },
    });
  });

  await act(async () => {
    await result.current.refine.onGenerateRefine();
  });

  await waitFor(() => {
    expect(result.current.refine.refineJobs).toHaveLength(1);
  });

  expect(result.current.refine.refineJobs[0].chunkIds).toEqual([9]);
  expect(result.current.state.activePanel).toBe('refine');
  await waitFor(() => {
    expect(refineBatch).toHaveBeenCalledWith(1, '提炼核心结论', expect.any(Array), [9]);
  });
});
