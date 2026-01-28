import { useCallback, useEffect } from 'react';
import useSWR from 'swr';

import { createSession, deleteSession, listSessions, updateSession } from '../api';
import { useWorkspaceDispatch, useWorkspaceState } from '../context/WorkspaceContext';
import type { ApiSession } from '../types';
import { normalizeSession } from '../utils';

export function useSessions() {
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  const isConnected = state.connectionState === 'live';

  const { data, error, isLoading, mutate } = useSWR(
    state.activeNotebookId && isConnected
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
    if (!isConnected) {
      dispatch({ type: 'SET_SESSIONS', payload: [] });
      dispatch({ type: 'SET_ACTIVE_SESSION', payload: null });
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
  }, [data, dispatch, error, isConnected, state.activeNotebookId, state.activeSessionId]);

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
      if (!isConnected) {
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'sessions', value: '未连接到后端服务，无法创建会话。' },
        });
        return null;
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
    [dispatch, isConnected, mutate, state.activeNotebookId],
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

  const handleUpdateSession = useCallback(
    async (sessionId: number, title: string) => {
      if (!state.activeNotebookId) return false;
      if (!isConnected) {
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'sessions', value: '未连接到后端服务，无法更新会话。' },
        });
        return false;
      }
      dispatch({ type: 'SET_ERROR', payload: { key: 'sessions', value: '' } });
      try {
        const updated = await updateSession(state.activeNotebookId, sessionId, {
          title: title.trim() || undefined,
        });
        const normalized = normalizeSession(updated);
        dispatch({
          type: 'SET_SESSIONS',
          payload: state.sessions.map((item) =>
            item.id === sessionId ? normalized : item,
          ),
        });
        await mutate(
          async (current: ApiSession[] | undefined) =>
            current?.map((item) => (item.id === sessionId ? updated : item)) ?? [],
          { revalidate: false },
        );
        return true;
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'sessions', value: '更新会话失败，请稍后重试。' },
        });
        return false;
      }
    },
    [dispatch, isConnected, mutate, state.activeNotebookId, state.sessions],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      if (!state.activeNotebookId) return false;
      if (!isConnected) {
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'sessions', value: '未连接到后端服务，无法删除会话。' },
        });
        return false;
      }
      dispatch({ type: 'SET_ERROR', payload: { key: 'sessions', value: '' } });
      try {
        await deleteSession(state.activeNotebookId, sessionId);
        const remaining = state.sessions.filter((item) => item.id !== sessionId);
        dispatch({ type: 'SET_SESSIONS', payload: remaining });
        if (state.activeSessionId === sessionId) {
          dispatch({ type: 'SET_ACTIVE_SESSION', payload: remaining[0]?.id ?? null });
        }
        await mutate(
          async (current: ApiSession[] | undefined) =>
            current?.filter((item) => item.id !== sessionId) ?? [],
          { revalidate: false },
        );
        return true;
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'sessions', value: '删除会话失败，请稍后重试。' },
        });
        return false;
      }
    },
    [dispatch, isConnected, mutate, state.activeNotebookId, state.activeSessionId, state.sessions],
  );

  return {
    sessions: state.sessions,
    activeSessionId: state.activeSessionId,
    setActiveSessionId,
    createSession: handleCreateSession,
    updateSession: handleUpdateSession,
    deleteSession: handleDeleteSession,
    ensureSession,
    isLoading: state.loading.sessions,
    error: state.errors.sessions,
    retrySessions,
    refreshSessions,
    isConnected,
  };
}
