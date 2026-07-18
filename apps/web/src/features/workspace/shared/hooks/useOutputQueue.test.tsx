import { act, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, expect, test, vi } from 'vitest';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceStore } from '../state/workspaceStore';
import { GENERATION_PREFERENCE_STORAGE_KEY } from './useGenerationPreference';
import { useOutputQueue } from './useOutputQueue';

function wrapSWR({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }}>
      {children}
    </SWRConfig>
  );
}

const onQueueReset = vi.fn();
const onQueueTotal = vi.fn();
const onQueueDone = vi.fn();
const markJobCompleted = vi.fn();

beforeEach(() => {
  window.localStorage.removeItem(GENERATION_PREFERENCE_STORAGE_KEY);

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
    loading: {
      notebooks: false,
      sources: false,
      sessions: false,
      messages: false,
      outputs: false,
      send: false,
    },
    errors: {
      notebooks: '',
      sources: '',
      sessions: '',
      messages: '',
      outputs: '',
      send: '',
      create: '',
    },
  });

  server.use(http.get('*/v2/outputs', () => HttpResponse.json([])));

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
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/v2/outputs', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 10,
        notebookId: 1,
        type: 'FAQ',
        prompt: 'hello',
        chunkIds: [1],
        content: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });
    }),
  );

  setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
  const { result } = renderHook(() => useOutputQueueHarness({ isConnected: true }), {
    wrapper: wrapSWR,
  });

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

  expect(capturedBody).toEqual({
    notebookId: 1,
    type: 'FAQ',
    prompt: 'hello',
    sourceIds: [1],
  });
});

test('enqueueOutputJob propagates generation preference', async () => {
  window.localStorage.setItem(GENERATION_PREFERENCE_STORAGE_KEY, 'speed');

  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/v2/outputs', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 12,
        notebookId: 1,
        type: 'FAQ',
        prompt: 'hello',
        chunkIds: [1],
        content: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });
    }),
  );

  setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
  const { result } = renderHook(() => useOutputQueueHarness({ isConnected: true }), {
    wrapper: wrapSWR,
  });

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

  expect(capturedBody).toEqual({
    notebookId: 1,
    type: 'FAQ',
    prompt: 'hello',
    sourceIds: [1],
    preference: 'speed',
  });
});

test('cancelOutputJob aborts running output job', async () => {
  // Mock reason: simulate in-flight request timing deterministically without wall-clock sleeps.
  vi.useFakeTimers();
  let deleteCalled = false;
  try {
    server.use(
      http.post('*/v2/outputs', async () => {
        await delay(200);
        return HttpResponse.json({
          id: 11,
          notebookId: 1,
          type: 'FAQ',
          prompt: 'hello',
          chunkIds: [1],
          content: {},
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        });
      }),
      http.delete('*/v2/outputs/:id', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
    const { result } = renderHook(() => useOutputQueueHarness({ isConnected: true }), {
      wrapper: wrapSWR,
    });

    const flushUntil = async (predicate: () => boolean) => {
      for (let i = 0; i < 10; i += 1) {
        if (predicate()) return;
        // eslint-disable-next-line no-await-in-loop -- Intentional polling helper for hook state updates in tests.
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
    expect(result.current.outputQueueJobs[0]?.status).toBe('cancelled');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    // AbortSignal should prevent a completed response from sticking; if a late
    // response still arrives after cancel, cleanup deletes the server row.
    expect(deleteCalled || result.current.outputQueueJobs[0]?.status === 'cancelled').toBe(true);
  } finally {
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});

test('enqueueOutputJob returns null when no sources selected', async () => {
  setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
  const { result } = renderHook(() => useOutputQueueHarness({ isConnected: true }), {
    wrapper: wrapSWR,
  });

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
  const { result } = renderHook(() => useOutputQueueHarness({ isConnected: false }), {
    wrapper: wrapSWR,
  });

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

test('enqueueSlidesJob settles when outline+markdown generation completes', async () => {
  let capturedBody: Record<string, unknown> | null = null;
  let draftStage: 'input' | 'outline' | 'markdown' = 'input';

  server.use(
    http.post('*/v2/studio/slides', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 5,
        notebookId: 1,
        outputId: null,
        title: 'Deck',
        prompt: 'Outline',
        engine: 'slidev',
        chunkIds: null,
        sourceIds: [1],
        outline: null,
        markdown: null,
        generationConfig: {},
        stage: 'input',
        status: 'idle',
        errorMessage: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });
    }),
    http.post('*/v2/studio/slides/:id/outline', () => {
      draftStage = 'outline';
      return HttpResponse.json({ ok: true });
    }),
    http.post('*/v2/studio/slides/:id/markdown', () => {
      draftStage = 'markdown';
      return HttpResponse.json({ ok: true });
    }),
    http.get('*/v2/studio/slides/:id', () => {
      if (draftStage === 'outline') {
        return HttpResponse.json({
          id: 5,
          notebookId: 1,
          outputId: null,
          title: 'Deck',
          prompt: 'Outline',
          engine: 'slidev',
          chunkIds: [1],
          sourceIds: [1],
          outline: { title: 'Deck', slides: [{ title: 'Intro', bullets: [] }] },
          markdown: null,
          generationConfig: {},
          stage: 'outline',
          status: 'idle',
          errorMessage: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:01Z',
        });
      }
      return HttpResponse.json({
        id: 5,
        notebookId: 1,
        outputId: 21,
        title: 'Deck',
        prompt: 'Outline',
        engine: 'slidev',
        chunkIds: [1],
        sourceIds: [1],
        outline: { title: 'Deck', slides: [{ title: 'Intro', bullets: [] }] },
        markdown: '# Deck',
        generationConfig: {},
        stage: 'markdown',
        status: 'idle',
        errorMessage: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:02Z',
      });
    }),
    http.get('*/v2/outputs', () =>
      HttpResponse.json(
        draftStage === 'markdown'
          ? [
              {
                id: 21,
                notebookId: 1,
                type: 'SLIDES',
                prompt: 'Outline',
                chunkIds: [1],
                content: {
                  title: 'Deck',
                  slideId: 5,
                  markdown: '# Deck',
                },
                createdAt: '2024-01-01T00:00:02Z',
                updatedAt: '2024-01-01T00:00:02Z',
              },
            ]
          : [],
      ),
    ),
  );

  setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
  const { result } = renderHook(() => useOutputQueueHarness({ isConnected: true }), {
    wrapper: wrapSWR,
  });

  await act(async () => {
    await result.current.enqueueSlidesJob({
      title: 'Deck',
      prompt: 'Outline',
      sourceIds: [1],
      generationConfig: {},
    } as any);
  });

  await waitFor(() => {
    expect(result.current.outputQueueJobs[0].status).toBe('done');
  });

  await waitFor(() => {
    expect(useWorkspaceStore.getState().outputs).toHaveLength(1);
  });

  expect(capturedBody).toEqual({
    notebookId: 1,
    title: 'Deck',
    prompt: 'Outline',
    sourceIds: [1],
    generationConfig: {},
  });
  expect(markJobCompleted).toHaveBeenCalled();
});
