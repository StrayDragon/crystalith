import { useCallback, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';

import { createSession, listSessions } from '../api';
import { useWorkspaceDispatch, useWorkspaceState } from '../context/WorkspaceContext';
import type { ApiSession, SessionSummary } from '../types';
import { normalizeSession } from '../utils';

export function useSessions() {
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  const isDemo = state.connectionState === 'demo';
  const demoSessions = useMemo<SessionSummary[]>(
    () => [
      {
        id: 101,
        title: '演示：需求梳理',
        createdAt: '刚刚',
        updatedAt: '刚刚',
      },
      {
        id: 102,
        title: '演示：竞品分析',
        createdAt: '昨天',
        updatedAt: '昨天',
      },
    ],
    [],
  );
  const lastNotebookIdRef = useRef<number | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    state.activeNotebookId && !isDemo
      ? ['workspace/sessions', state.activeNotebookId]
      : null,
    () => listSessions(state.activeNotebookId ?? 0),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'sessions', value: isLoading } });
  }, [dispatch, isLoading]);

  useEffect(() => {
    if (!state.activeNotebookId) {
      dispatch({ type: 'SET_SESSIONS', payload: [] });
      return;
    }
    if (isDemo) {
      if (lastNotebookIdRef.current !== state.activeNotebookId) {
        dispatch({ type: 'SET_SESSIONS', payload: demoSessions });
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: demoSessions[0]?.id ?? null });
        lastNotebookIdRef.current = state.activeNotebookId;
      }
      return;
    }
    if (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: { key: 'sessions', value: '会话加载失败，请稍后重试。' },
      });
      return;
    }
    if (data) {
      const normalized = data.map(normalizeSession);
      const activeId = state.activeSessionId;
      const nextActive =
        normalized.find((item) => item.id === activeId)?.id ?? normalized[0]?.id ?? null;
      dispatch({ type: 'SET_SESSIONS', payload: normalized });
      dispatch({ type: 'SET_ERROR', payload: { key: 'sessions', value: '' } });
      if (nextActive !== activeId) {
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: nextActive });
      }
    }
  }, [
    data,
    demoSessions,
    dispatch,
    error,
    isDemo,
    state.activeNotebookId,
    state.activeSessionId,
  ]);

  const setActiveSessionId = useCallback(
    (sessionId: number | null) => {
      if (sessionId === state.activeSessionId) return;
      dispatch({ type: 'SET_ACTIVE_SESSION', payload: sessionId });
    },
    [dispatch, state.activeSessionId],
  );

  const handleCreateSession = useCallback(
    async (title?: string | null) => {
      if (!state.activeNotebookId) return null;
      if (isDemo) {
        const nextId = Date.now();
        const demoSession: SessionSummary = {
          id: nextId,
          title: title?.trim() || '新的会话',
          createdAt: '刚刚',
          updatedAt: '刚刚',
        };
        dispatch({ type: 'SET_SESSIONS', payload: [demoSession, ...state.sessions] });
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: demoSession.id });
        return demoSession.id;
      }
      dispatch({ type: 'SET_ERROR', payload: { key: 'sessions', value: '' } });
      try {
        const created = await createSession(state.activeNotebookId, title ?? null);
        const normalized = normalizeSession(created);
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: normalized.id });
        await mutate(
          async (current: ApiSession[] | undefined) =>
            current ? [created, ...current] : [created],
          { revalidate: false },
        );
        return normalized.id;
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'sessions', value: '创建会话失败，请检查后端状态。' },
        });
        return null;
      }
    },
    [dispatch, isDemo, mutate, state.activeNotebookId, state.sessions],
  );

  const ensureSession = useCallback(
    async (title?: string | null) => {
      if (state.activeSessionId) return state.activeSessionId;
      return handleCreateSession(title ?? null);
    },
    [handleCreateSession, state.activeSessionId],
  );

  const retrySessions = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: { key: 'sessions', value: '' } });
    await mutate();
  }, [dispatch, mutate]);

  const refreshSessions = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    sessions: state.sessions,
    activeSessionId: state.activeSessionId,
    setActiveSessionId,
    createSession: handleCreateSession,
    ensureSession,
    isLoading: state.loading.sessions,
    error: state.errors.sessions,
    retrySessions,
    refreshSessions,
    isDemo,
  };
}
