import { act, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import useSWR from 'swr';

import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useOutputQueue } from './useOutputQueue';
import { createOutputV1NotebooksNotebookIdOutputsOutputTypePost as createOutput } from '../../../../api/generated';
import { GENERATION_PREFERENCE_STORAGE_KEY } from './useGenerationPreference';

vi.mock('swr', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../api/generated', () => ({
  createOutputV1NotebooksNotebookIdOutputsOutputTypePost: vi.fn(),
  createDraftV1NotebooksNotebookIdSlidesDraftsPost: vi.fn(),
  deleteOutputV1NotebooksNotebookIdOutputsOutputIdDelete: vi.fn(),
  getOutputV1NotebooksNotebookIdOutputsOutputIdGet: vi.fn(),
  listOutputsV1NotebooksNotebookIdOutputsGet: vi.fn(),
}));

const swrMock = vi.mocked(useSWR);

const onQueueReset = vi.fn();
const onQueueTotal = vi.fn();
const onQueueDone = vi.fn();
const markJobCompleted = vi.fn();

beforeEach(() => {
  window.localStorage.removeItem(GENERATION_PREFERENCE_STORAGE_KEY);

  // Reset Zustand store
  useWorkspaceStore.setState({
    notebooks: [],
    activeNotebookId: null,
    sessions: [],
    activeSessionId: null,
    sources: [],
    selectedSourceIds: {},
    messages: [],
    draft: '',
    citations: [],
    hoveredCitationChunkId: null,
    hoveredMessageChunkIds: [],
    jumpToCitationChunkId: null,
    outputs: [],
    outputType: 'FAQ',
    refineMode: 'paragraph',
    refinePrompt: '',
    refineJobs: [],
    refineSettings: { autoTrigger: false, asyncQueue: true },
    hasNewOutput: false,
    recentCompletedJobId: null,
    activePanel: 'chat',
    createState: 'idle',
    createName: '',
    connectionState: 'connecting',
    uploadState: 'idle',
    loading: { notebooks: false, sources: false, sessions: false, messages: false, outputs: false, send: false },
    errors: { notebooks: '', sources: '', sessions: '', messages: '', outputs: '', send: '', create: '' },
  });

  swrMock.mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  onQueueReset.mockClear();
  onQueueTotal.mockClear();
  onQueueDone.mockClear();
  markJobCompleted.mockClear();
});

function setWorkspaceStateForOutputQueue({
  isConnected,
  activeNotebookId,
}: {
  isConnected: boolean;
  activeNotebookId: number | null;
}) {
  useWorkspaceStore.setState({
    activeNotebookId,
    connectionState: isConnected ? 'live' : 'connecting',
  });
}

function useOutputQueueHarness({ isConnected }: { isConnected: boolean }) {
  const queue = useOutputQueue({
    isConnected,
    hasPendingRefineJobs: () => false,
    onQueueReset,
    onQueueTotal,
    onQueueDone,
    markJobCompleted,
  });

  return { ...queue };
}

test('enqueueOutputJob processes and updates outputs', async () => {
  vi.mocked(createOutput).mockResolvedValue({
    data: {
      id: 10,
      type: 'FAQ',
      prompt: 'hello',
      chunk_ids: [1],
      content: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  } as any);

  setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
  const { result } = renderHook(() =>
    useOutputQueueHarness({ isConnected: true }),
  );

  act(() => {
    result.current.enqueueOutputJob({
      type: 'FAQ',
      prompt: 'hello',
      sourceIds: [1],
    });
  });

  await waitFor(() => {
    expect(result.current.outputQueueJobs[0].status).toBe('done');
  });

  await waitFor(() => {
    expect(useWorkspaceStore.getState().outputs).toHaveLength(1);
  });

  expect(createOutput).toHaveBeenCalledWith({
    path: { notebook_id: 1, output_type: 'FAQ' },
    body: {
      prompt: 'hello',
      source_ids: [1],
      model_id: undefined,
    },
    signal: expect.any(AbortSignal),
  });
});

test('enqueueOutputJob propagates generation preference', async () => {
  window.localStorage.setItem(GENERATION_PREFERENCE_STORAGE_KEY, 'speed');

  vi.mocked(createOutput).mockResolvedValue({
    data: {
      id: 12,
      type: 'FAQ',
      prompt: 'hello',
      chunk_ids: [1],
      content: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  } as any);

  setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
  const { result } = renderHook(() => useOutputQueueHarness({ isConnected: true }));

  act(() => {
    result.current.enqueueOutputJob({
      type: 'FAQ',
      prompt: 'hello',
      sourceIds: [1],
    });
  });

  await waitFor(() => {
    expect(result.current.outputQueueJobs[0].status).toBe('done');
  });

  expect(createOutput).toHaveBeenCalledWith({
    path: { notebook_id: 1, output_type: 'FAQ' },
    body: {
      prompt: 'hello',
      source_ids: [1],
      preference: 'speed',
      model_id: undefined,
    },
    signal: expect.any(AbortSignal),
  });
});

test('cancelOutputJob aborts running output job', async () => {
  vi.useFakeTimers();
  try {
    vi.mocked(createOutput).mockImplementation((({ signal }: any) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
        setTimeout(() => {
          resolve({
            data: {
              id: 11,
              type: 'FAQ',
              prompt: 'hello',
              chunk_ids: [1],
              content: {},
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          } as any);
        }, 200);
      })) as any);

    setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
    const { result } = renderHook(() =>
      useOutputQueueHarness({ isConnected: true }),
    );

    const flushUntil = async (predicate: () => boolean) => {
      for (let i = 0; i < 10; i += 1) {
        if (predicate()) return;
        await act(async () => {});
      }
      throw new Error('condition not met');
    };

    act(() => {
      result.current.enqueueOutputJob({
        type: 'FAQ',
        prompt: 'hello',
        sourceIds: [1],
      });
    });

    await flushUntil(() => result.current.outputQueueJobs[0]?.status === 'running');

    await act(async () => {
      result.current.cancelOutputJob(result.current.outputQueueJobs[0].id);
      await Promise.resolve();
    });

    await flushUntil(() => result.current.outputQueueJobs[0]?.status === 'cancelled');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
  } finally {
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});

test('enqueueOutputJob returns null when no sources selected', async () => {
  setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
  const { result } = renderHook(() =>
    useOutputQueueHarness({ isConnected: true }),
  );

  let created: any = null;
  act(() => {
    created = result.current.enqueueOutputJob({
      type: 'FAQ',
      prompt: 'hello',
      sourceIds: [],
    });
  });

  expect(created).toBeNull();
  expect(useWorkspaceStore.getState().errors.outputs).toBe('请先选择来源。');
});

test('enqueueSlidesJob returns null when disconnected', async () => {
  setWorkspaceStateForOutputQueue({ isConnected: false, activeNotebookId: 1 });
  const { result } = renderHook(() =>
    useOutputQueueHarness({ isConnected: false }),
  );

  let created: any = null;
  await act(async () => {
    created = await result.current.enqueueSlidesJob({
      title: 'Deck',
      prompt: 'Outline',
      sourceIds: [],
      generationConfig: {},
    } as any);
  });

  expect(created).toBeNull();
  expect(useWorkspaceStore.getState().errors.outputs).toBe('未连接到后端服务。');
});
