import { act, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

import { renderHook } from '../../../../test-utils/renderHook';
import { useResearch } from './useResearch';
import {
  createResearchSessionV1NotebooksNotebookIdResearchPost,
  deleteResearchSessionV1NotebooksNotebookIdResearchResearchIdDelete,
  listResearchSessionsV1NotebooksNotebookIdResearchGet,
} from '../../../../api/generated';

vi.mock('../../../../api/generated', () => ({
  createResearchSessionV1NotebooksNotebookIdResearchPost: vi.fn(),
  deleteResearchSessionV1NotebooksNotebookIdResearchResearchIdDelete: vi.fn(),
  listResearchSessionsV1NotebooksNotebookIdResearchGet: vi.fn(),
  getResearchSessionV1NotebooksNotebookIdResearchResearchIdGet: vi.fn(),
  startResearchV1NotebooksNotebookIdResearchResearchIdStartPost: vi.fn(),
  approveSearchPlanV1NotebooksNotebookIdResearchResearchIdApprovePost: vi.fn(),
  finishResearchV1NotebooksNotebookIdResearchResearchIdFinishPost: vi.fn(),
  skipIterationV1NotebooksNotebookIdResearchResearchIdSkipPost: vi.fn(),
  cancelResearchV1NotebooksNotebookIdResearchResearchIdCancelPost: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test('fetchSessions stores list data', async () => {
  vi.mocked(listResearchSessionsV1NotebooksNotebookIdResearchGet).mockResolvedValue({
    data: [
      {
        id: 1,
        notebook_id: 1,
        topic: 'Topic',
        status: 'planning',
        current_iteration: 0,
        max_iterations: 3,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ],
  } as any);

  const { result } = renderHook(() => useResearch(1));

  await act(async () => {
    await result.current.fetchSessions();
  });

  await waitFor(() => {
    expect(result.current.sessions).toHaveLength(1);
  });
  expect(result.current.sessions[0].topic).toBe('Topic');
});

test('createSession updates sessions and activeSession', async () => {
  vi.mocked(createResearchSessionV1NotebooksNotebookIdResearchPost).mockResolvedValue({
    data: {
      id: 2,
      notebook_id: 1,
      topic: 'New Topic',
      status: 'planning',
      current_iteration: 0,
      max_iterations: 4,
      created_at: '2024-01-02',
      updated_at: '2024-01-02',
    },
  } as any);

  const { result } = renderHook(() => useResearch(1));

  let created: any = null;
  await act(async () => {
    created = await result.current.createSession('New Topic', 4);
  });

  expect(created?.id).toBe(2);
  await waitFor(() => {
    expect(result.current.sessions[0].id).toBe(2);
  });
  expect(result.current.activeSession?.id).toBe(2);
});

test('deleteSession removes session and clears active session', async () => {
  vi.mocked(createResearchSessionV1NotebooksNotebookIdResearchPost).mockResolvedValue({
    data: {
      id: 22,
      notebook_id: 1,
      topic: 'Topic',
      status: 'planning',
      current_iteration: 0,
      max_iterations: 4,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  } as any);

  vi.mocked(deleteResearchSessionV1NotebooksNotebookIdResearchResearchIdDelete).mockResolvedValue(
    { data: {} } as any,
  );

  const { result } = renderHook(() => useResearch(1));

  await act(async () => {
    await result.current.createSession('Topic');
  });

  await act(async () => {
    await result.current.deleteSession(22);
  });

  expect(result.current.sessions).toHaveLength(0);
  expect(result.current.activeSession).toBeNull();
});

test('SSE reconnect does not use stale session state after completion', async () => {
  vi.useFakeTimers();

  class MockEventSource {
    static instances: MockEventSource[] = [];
    onerror: (() => void) | null = null;
    onopen: (() => void) | null = null;
    closed = false;
    url: string;

    constructor(url: string) {
      this.url = url;
      MockEventSource.instances.push(this);
    }

    addEventListener(_type: string, _listener: any) {
      return;
    }

    close() {
      this.closed = true;
    }

    triggerError() {
      this.onerror?.();
    }
  }

  vi.stubGlobal('EventSource', MockEventSource as any);

  const baseSession = {
    id: 1,
    notebook_id: 1,
    topic: 'Topic',
    status: 'planning',
    current_iteration: 0,
    max_iterations: 3,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  try {
    vi.mocked(listResearchSessionsV1NotebooksNotebookIdResearchGet).mockResolvedValueOnce({
      data: [baseSession],
    } as any);

    const { result } = renderHook(() => useResearch(1));

    await act(async () => {
      await result.current.fetchSessions();
    });

    act(() => {
      result.current.subscribeToSSE(1);
    });

    expect(MockEventSource.instances).toHaveLength(1);

    vi.mocked(listResearchSessionsV1NotebooksNotebookIdResearchGet).mockResolvedValueOnce({
      data: [{ ...baseSession, status: 'completed' }],
    } as any);

    await act(async () => {
      await result.current.fetchSessions();
    });

    expect(result.current.sessions[0].status).toBe('completed');

    act(() => {
      MockEventSource.instances[0].triggerError();
      vi.advanceTimersByTime(1000);
    });

    expect(MockEventSource.instances).toHaveLength(1);
  } finally {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
