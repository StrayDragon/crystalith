import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { useResearch } from './useResearch';

const streamRequestMock = vi.fn();

// Mock reason: control research SSE lifecycle without a real EventSource / fetch stream.
vi.mock('../../../../api/stream', () => ({
  streamRequest: (...args: unknown[]) => streamRequestMock(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  streamRequestMock.mockReset();
});

test('fetchSessions stores list data', async () => {
  server.use(
    http.get('*/v2/notebooks/*/research', () =>
      HttpResponse.json({
        items: [
          {
            id: 1,
            notebookId: 1,
            topic: 'Topic',
            status: 'planning',
            currentIteration: 1,
            maxIterations: 3,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
        offset: 0,
        limit: 200,
      }),
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
    http.post('*/v2/notebooks/*/research', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      expect(body).toEqual({
        topic: 'New Topic',
        maxIterations: 4,
      });
      return HttpResponse.json({
        id: 2,
        notebookId: 1,
        topic: String(body.topic ?? 'New Topic'),
        status: 'planning',
        currentIteration: 1,
        maxIterations: Number(body.maxIterations ?? 4),
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
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
    http.post('*/v2/notebooks/*/research', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 22,
        notebookId: 1,
        topic: String(body.topic ?? 'Topic'),
        status: 'planning',
        currentIteration: 1,
        maxIterations: Number(body.maxIterations ?? 4),
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });
    }),
    http.delete(
      '*/v2/notebooks/*/research/:research_id',
      () => new HttpResponse(null, { status: 204 }),
    ),
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

  const baseSession = {
    id: 1,
    notebookId: 1,
    topic: 'Topic',
    status: 'planning',
    currentIteration: 1,
    maxIterations: 3,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  let listCount = 0;
  let rejectStream: ((error: Error) => void) | null = null;

  streamRequestMock.mockImplementation(async function* () {
    await new Promise<never>((_resolve, reject) => {
      rejectStream = reject;
    });
    // Unreachable after reject; keep a yield so the generator is valid for oxlint.
    yield undefined as never;
  });

  server.use(
    http.get('*/v2/notebooks/*/research', () => {
      listCount += 1;
      if (listCount === 1) {
        return HttpResponse.json({ items: [baseSession], total: 1, offset: 0, limit: 200 });
      }
      return HttpResponse.json({
        items: [{ ...baseSession, status: 'completed' }],
        total: 1,
        offset: 0,
        limit: 200,
      });
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

    expect(streamRequestMock).toHaveBeenCalledTimes(1);
    expect(streamRequestMock.mock.calls[0][0]).toBe('/v2/notebooks/1/research/1/stream');

    await act(async () => {
      await result.current.fetchSessions();
    });

    expect(result.current.sessions[0].status).toBe('completed');

    await act(async () => {
      rejectStream?.(new Error('connection lost'));
      await Promise.resolve();
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    // Completed sessions must not schedule reconnects.
    expect(streamRequestMock).toHaveBeenCalledTimes(1);
  } finally {
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});
