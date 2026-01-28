import { act, waitFor } from '@testing-library/react';
import { useReducer } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import useSWR from 'swr';

import { renderHook } from '../../../../test-utils/renderHook';
import { initialWorkspaceState, workspaceReducer } from '../state/workspaceReducer';
import { useOutputQueue } from './useOutputQueue';
import { createOutput } from '../api';

vi.mock('swr', () => ({
  default: vi.fn(),
}));

vi.mock('../api', () => ({
  createOutput: vi.fn(),
  createSlidesDraft: vi.fn(),
  deleteOutput: vi.fn(),
  getOutput: vi.fn(),
  listOutputs: vi.fn(),
}));

const swrMock = vi.mocked(useSWR);

beforeEach(() => {
  swrMock.mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  });
});

const onQueueReset = vi.fn();
const onQueueTotal = vi.fn();
const onQueueDone = vi.fn();
const markJobCompleted = vi.fn();

function useOutputQueueHarness({
  isConnected,
  activeNotebookId,
}: {
  isConnected: boolean;
  activeNotebookId: number | null;
}) {
  const [state, dispatch] = useReducer(workspaceReducer, {
    ...initialWorkspaceState,
    activeNotebookId,
    connectionState: isConnected ? 'live' : 'connecting',
  });

  const queue = useOutputQueue({
    state,
    dispatch,
    isConnected,
    hasPendingRefineJobs: () => false,
    onQueueReset,
    onQueueTotal,
    onQueueDone,
    markJobCompleted,
  });

  return { state, dispatch, ...queue };
}

test('enqueueOutputJob processes and updates outputs', async () => {
  vi.mocked(createOutput).mockResolvedValue({
    id: 10,
    type: 'FAQ',
    prompt: 'hello',
    chunk_ids: [1],
    content: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as any);

  const { result } = renderHook(() =>
    useOutputQueueHarness({ isConnected: true, activeNotebookId: 1 }),
  );

  act(() => {
    result.current.enqueueOutputJob({
      type: 'FAQ',
      prompt: 'hello',
      chunkIds: [1],
    });
  });

  await waitFor(() => {
    expect(result.current.outputQueueJobs[0].status).toBe('done');
  });

  await waitFor(() => {
    expect(result.current.state.outputs).toHaveLength(1);
  });

  expect(createOutput).toHaveBeenCalledWith(1, 'FAQ', {
    prompt: 'hello',
    chunk_ids: [1],
    model_id: undefined,
  });
});

test('enqueueSlidesJob returns null when disconnected', async () => {
  const { result } = renderHook(() =>
    useOutputQueueHarness({ isConnected: false, activeNotebookId: 1 }),
  );

  let created: any = null;
  await act(async () => {
    created = await result.current.enqueueSlidesJob({
      title: 'Deck',
      prompt: 'Outline',
      chunkIds: [],
      generationConfig: {},
    } as any);
  });

  expect(created).toBeNull();
  expect(result.current.state.errors.outputs).toBe('未连接到后端服务。');
});
