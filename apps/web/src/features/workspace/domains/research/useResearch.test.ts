import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { useResearch } from './useResearch';

beforeEach(() => {
  vi.clearAllMocks();
});

test('fetchSessions stores list data', async () => {
  server.use(
    http.get('*/v1/notebooks/:notebookId/research', () =>
      HttpResponse.json([
        {
          id: 1,
          notebookId: 1,
          topic: 'Topic',
          status: 'planning',
          current_iteration: 0,
          max_iterations: 3,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ]),
    ),
  );

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
  server.use(
    http.post('*/v1/notebooks/:notebookId/research', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 2,
        notebookId: Number(params.notebookId),
        topic: String(body.topic ?? 'New Topic'),
        status: 'planning',
        current_iteration: 0,
        max_iterations: Number(body.max_iterations ?? 4),
        createdAt: '2024-01-02',
        updatedAt: '2024-01-02',
      });
    }),
  );

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
  server.use(
    http.post('*/v1/notebooks/:notebookId/research', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 22,
        notebookId: Number(params.notebookId),
        topic: String(body.topic ?? 'Topic'),
        status: 'planning',
        current_iteration: 0,
        max_iterations: Number(body.max_iterations ?? 4),
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      });
    }),
    http.delete('*/v1/notebooks/:notebookId/research/:research_id', () => HttpResponse.json({})),
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

  // Mock reason: deterministic control of reconnect/error lifecycle is not reliable with real EventSource in jsdom.
  vi.stubGlobal('EventSource', MockEventSource as any);

  const baseSession = {
    id: 1,
    notebookId: 1,
    topic: 'Topic',
    status: 'planning',
    current_iteration: 0,
    max_iterations: 3,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  let listCount = 0;
  server.use(
    http.get('*/v1/notebooks/:notebookId/research', () => {
      listCount += 1;
      if (listCount === 1) {
        return HttpResponse.json([baseSession]);
      }
      return HttpResponse.json([{ ...baseSession, status: 'completed' }]);
    }),
  );

  try {
    const { result } = renderHook(() => useResearch(1));

    await act(async () => {
      await result.current.fetchSessions();
    });

    act(() => {
      result.current.subscribeToSSE(1);
    });

    expect(MockEventSource.instances).toHaveLength(1);

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
