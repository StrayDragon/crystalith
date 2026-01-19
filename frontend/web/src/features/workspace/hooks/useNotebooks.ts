import { useCallback, useEffect, useMemo } from 'react';
import useSWR from 'swr';

import { createNotebook, listNotebooks } from '../api';
import { useWorkspaceDispatch, useWorkspaceState } from '../context/WorkspaceContext';
import type { ApiNotebook, StatusLabel } from '../types';
import { normalizeNotebook } from '../utils';

export function useNotebooks() {
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  const demoNotebooks = useMemo<ApiNotebook[]>(
    () => [
      { id: 1, name: '示例：产品调研', updated_at: new Date().toISOString() },
      {
        id: 2,
        name: '示例：技术笔记',
        updated_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    [],
  );
  const demoNormalized = useMemo(
    () => demoNotebooks.map(normalizeNotebook),
    [demoNotebooks],
  );

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
      dispatch({ type: 'SET_CONNECTION_STATE', payload: 'demo' });
      dispatch({ type: 'SET_NOTEBOOKS', payload: demoNormalized });
      const nextActive = demoNormalized[0]?.id ?? null;
      if (nextActive !== state.activeNotebookId) {
        dispatch({ type: 'SET_ACTIVE_NOTEBOOK', payload: nextActive });
      }
      dispatch({
        type: 'SET_ERROR',
        payload: { key: 'notebooks', value: '未连接到后端服务，已切换为演示数据。' },
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
  }, [
    demoNormalized,
    dispatch,
    notebookData,
    notebookError,
    state.activeNotebookId,
  ]);

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
    if (!name || state.connectionState === 'demo') return false;
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

  const statusLabel = useMemo<StatusLabel>(() => {
    if (state.connectionState === 'connecting') {
      return { text: '连接中', tone: 'isLoading', tooltip: '正在连接后端服务' };
    }
    if (state.connectionState === 'demo') {
      return { text: '演示模式', tone: 'isDemo', tooltip: '当前为前端演示数据' };
    }
    return { text: '已连接', tone: 'isLive', tooltip: '已连接到后端服务' };
  }, [state.connectionState]);

  return {
    notebooks: state.notebooks,
    activeNotebookId: state.activeNotebookId,
    setActiveNotebookId,
    createName: state.createName,
    setCreateName,
    createState: state.createState,
    createNotebook: handleCreateNotebook,
    statusLabel,
    connectionState: state.connectionState,
    notebooksError: state.errors.notebooks,
    createError: state.errors.create,
    isLoading: state.loading.notebooks,
    retryNotebooks,
    isDemo: state.connectionState === 'demo',
  };
}
