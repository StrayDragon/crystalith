import { useCallback, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';

import { createNotebook, deleteNotebook, listNotebooks, updateNotebook } from '../api';
import { useWorkspaceDispatch, useWorkspaceState } from '../context/WorkspaceContext';
import type { StatusLabel } from '../types';
import { normalizeNotebook } from '../utils';

const DEFAULT_NOTEBOOK_NAME = '未命名笔记本';

export function useNotebooks() {
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  // Track if we've already attempted to auto-create a notebook
  const autoCreateAttemptedRef = useRef(false);
  const {
    data: notebookData,
    error: notebookError,
    isLoading,
    mutate,
  } = useSWR('workspace/notebooks', listNotebooks, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'notebooks', value: isLoading } });
  }, [dispatch, isLoading]);

  useEffect(() => {
    if (notebookError) {
      dispatch({ type: 'SET_CONNECTION_STATE', payload: 'error' });
      dispatch({ type: 'SET_NOTEBOOKS', payload: [] });
      if (state.activeNotebookId !== null) {
        dispatch({ type: 'SET_ACTIVE_NOTEBOOK', payload: null });
      }
      dispatch({
        type: 'SET_ERROR',
        payload: { key: 'notebooks', value: '未连接到后端服务，请检查后重试。' },
      });
      return;
    }

    if (!notebookData) return;
    const normalized = notebookData.map(normalizeNotebook);
    const currentActive = state.activeNotebookId;
    const nextActive =
      normalized.find((item) => item.id === currentActive)?.id ?? normalized[0]?.id ?? null;
    dispatch({ type: 'SET_NOTEBOOKS', payload: normalized });
    dispatch({ type: 'SET_CONNECTION_STATE', payload: 'live' });
    dispatch({ type: 'SET_ERROR', payload: { key: 'notebooks', value: '' } });
    if (nextActive !== currentActive) {
      dispatch({ type: 'SET_ACTIVE_NOTEBOOK', payload: nextActive });
    }
  }, [dispatch, notebookData, notebookError, state.activeNotebookId]);

  // Auto-create a default notebook when there are no notebooks
  useEffect(() => {
    // Only attempt auto-create once per session
    if (autoCreateAttemptedRef.current) return;
    // Wait for data to be loaded and connection to be live
    if (isLoading || notebookError || !notebookData) return;
    // Only create if there are no notebooks
    if (notebookData.length > 0) return;

    autoCreateAttemptedRef.current = true;

    const autoCreateNotebook = async () => {
      dispatch({ type: 'SET_CREATE_STATE', payload: 'loading' });
      try {
        const created = await createNotebook(DEFAULT_NOTEBOOK_NAME);
        const normalized = normalizeNotebook(created);
        dispatch({ type: 'SET_ACTIVE_NOTEBOOK', payload: normalized.id });
        await mutate(
          async (current) => (current ? [...current, created] : [created]),
          { revalidate: false },
        );
      } catch (error) {
        // Silent fail - user can manually create a notebook
        console.error('Failed to auto-create notebook:', error);
      } finally {
        dispatch({ type: 'SET_CREATE_STATE', payload: 'idle' });
      }
    };

    autoCreateNotebook();
  }, [dispatch, isLoading, mutate, notebookData, notebookError]);

  const setActiveNotebookId = useCallback(
    (value: number | null) => {
      if (value === state.activeNotebookId) return;
      dispatch({ type: 'SET_ACTIVE_NOTEBOOK', payload: value });
    },
    [dispatch, state.activeNotebookId],
  );

  const setCreateName = useCallback(
    (value: string) => {
      dispatch({ type: 'SET_CREATE_NAME', payload: value });
    },
    [dispatch],
  );

  const handleCreateNotebook = useCallback(async () => {
    const name = state.createName.trim();
    if (!name || state.connectionState !== 'live') return false;
    dispatch({ type: 'SET_CREATE_STATE', payload: 'loading' });
    dispatch({ type: 'SET_ERROR', payload: { key: 'create', value: '' } });
    try {
      const created = await createNotebook(name);
      const normalized = normalizeNotebook(created);
      dispatch({ type: 'SET_CREATE_NAME', payload: '' });
      dispatch({ type: 'SET_ACTIVE_NOTEBOOK', payload: normalized.id });
      await mutate(
        async (current) => (current ? [...current, created] : [created]),
        { revalidate: false },
      );
      return true;
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: { key: 'create', value: '创建失败，请检查后端状态。' },
      });
      return false;
    } finally {
      dispatch({ type: 'SET_CREATE_STATE', payload: 'idle' });
    }
  }, [dispatch, mutate, state.connectionState, state.createName]);

  const retryNotebooks = useCallback(async () => {
    dispatch({ type: 'SET_CONNECTION_STATE', payload: 'connecting' });
    dispatch({ type: 'SET_ERROR', payload: { key: 'notebooks', value: '' } });
    await mutate();
  }, [dispatch, mutate]);

  const handleUpdateNotebook = useCallback(
    async (notebookId: number, name: string) => {
      if (state.connectionState !== 'live') return false;
      const trimmed = name.trim();
      if (!trimmed) return false;
      try {
        const updated = await updateNotebook(notebookId, { name: trimmed });
        const normalized = normalizeNotebook(updated);
        await mutate(
          async (current) =>
            current?.map((item) => (item.id === notebookId ? updated : item)) ?? [updated],
          { revalidate: false },
        );
        dispatch({
          type: 'SET_NOTEBOOKS',
          payload: state.notebooks.map((item) =>
            item.id === notebookId ? normalized : item,
          ),
        });
        return true;
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'notebooks', value: '更新笔记本失败，请稍后重试。' },
        });
        return false;
      }
    },
    [dispatch, mutate, state.connectionState, state.notebooks],
  );

  const handleDeleteNotebook = useCallback(
    async (notebookId: number) => {
      if (state.connectionState !== 'live') return false;
      try {
        await deleteNotebook(notebookId);
        await mutate(
          async (current) => current?.filter((item) => item.id !== notebookId) ?? [],
          { revalidate: false },
        );
        const remaining = state.notebooks.filter((item) => item.id !== notebookId);
        dispatch({ type: 'SET_NOTEBOOKS', payload: remaining });
        if (state.activeNotebookId === notebookId) {
          dispatch({ type: 'SET_ACTIVE_NOTEBOOK', payload: remaining[0]?.id ?? null });
        }
        return true;
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'notebooks', value: '删除笔记本失败，请稍后重试。' },
        });
        return false;
      }
    },
    [dispatch, mutate, state.activeNotebookId, state.connectionState, state.notebooks],
  );

  const statusLabel = useMemo<StatusLabel>(() => {
    if (state.connectionState === 'connecting') {
      return { text: '连接中', tone: 'isLoading', tooltip: '正在连接后端服务' };
    }
    if (state.connectionState === 'error') {
      return { text: '连接失败', tone: 'isError', tooltip: '未连接到后端服务' };
    }
    return { text: '已连接', tone: 'isLive', tooltip: '已连接到后端服务' };
  }, [state.connectionState]);
  const isConnected = state.connectionState === 'live';

  return {
    notebooks: state.notebooks,
    activeNotebookId: state.activeNotebookId,
    setActiveNotebookId,
    createName: state.createName,
    setCreateName,
    createState: state.createState,
    createNotebook: handleCreateNotebook,
    updateNotebook: handleUpdateNotebook,
    deleteNotebook: handleDeleteNotebook,
    statusLabel,
    connectionState: state.connectionState,
    notebooksError: state.errors.notebooks,
    createError: state.errors.create,
    isLoading: state.loading.notebooks,
    retryNotebooks,
    isConnected,
  };
}
