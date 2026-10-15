import { beforeEach, expect, test, rs } from '@rstest/core';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { useSessions } from './useSessions';

function wrapSWR({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }}>
      {children}
    </SWRConfig>
  );
}

function sessionItem(id: number) {
  return { id, notebookId: 1, title: `会话 ${id}`, createdAt: '2026-10-15T00:00:00.000Z' };
}

beforeEach(() => {
  useWorkspaceStore.setState({
    notebooks: [],
    activeNotebookId: null,
    sessions: [],
    activeSessionId: null,
    connectionState: 'connecting',
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

  server.use(
    http.get('*/v2/notebooks/:notebookId/sessions', () =>
      HttpResponse.json({
        items: [sessionItem(7)],
        total: 1,
        offset: 0,
        limit: 200,
      }),
    ),
  );
});

// Regression (known-issues 2026-10-15): attaching a stale most-recent session
// mid-send swaps the transcript and wipes the optimistic user bubble.
test('sessions effect does not auto-attach while a send is in flight', async () => {
  let sessionsCalls = 0;
  server.use(
    http.get('*/v2/notebooks/:notebookId/sessions', () => {
      sessionsCalls += 1;
      // Second fetch returns a different id so SWR's data reference changes
      // and the effect re-runs after the send settles.
      return HttpResponse.json({
        items: [sessionItem(sessionsCalls === 1 ? 7 : 8)],
        total: 1,
        offset: 0,
        limit: 200,
      });
    }),
  );
  const { result } = renderHook(() => useSessions(), { wrapper: wrapSWR });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setLoading('send', true);
  });

  await waitFor(() => {
    expect(result.current.sessions).toHaveLength(1);
  });

  expect(useWorkspaceStore.getState().activeSessionId).toBeNull();

  // After the send settles, the next revalidation attaches the latest session.
  act(() => {
    useWorkspaceStore.getState().setLoading('send', false);
  });
  await act(async () => {
    await result.current.retrySessions();
  });
  await waitFor(() => {
    expect(useWorkspaceStore.getState().activeSessionId).toBe(8);
  });
});

test('sessions effect does not clear activeId on a transiently empty list mid-send', async () => {
  server.use(
    http.get('*/v2/notebooks/:notebookId/sessions', () =>
      HttpResponse.json({ items: [], total: 0, offset: 0, limit: 200 }),
    ),
  );
  const { result } = renderHook(() => useSessions(), { wrapper: wrapSWR });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setActiveSession(7);
    s.setLoading('send', true);
  });

  await waitFor(() => {
    expect(result.current.sessions).toEqual([]);
  });

  expect(useWorkspaceStore.getState().activeSessionId).toBe(7);
});
