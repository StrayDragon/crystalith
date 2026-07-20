import { useCallback, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type { StatusLabel } from '../../shared/types';
import { normalizeNotebook, pickDefaultNotebookId } from '../../shared/utils';

const DEFAULT_NOTEBOOK_NAME = '未命名笔记本';

export function useNotebooks() {
  const notebooks = useWorkspaceStore((s) => s.notebooks);
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const createStateCurrent = useWorkspaceStore((s) => s.createState);
  const createNameCurrent = useWorkspaceStore((s) => s.createName);
  const loadingNotebooks = useWorkspaceStore((s) => s.loading.notebooks);
  const errNotebooks = useWorkspaceStore((s) => s.errors.notebooks);
  const errCreate = useWorkspaceStore((s) => s.errors.create);

  const store = useWorkspaceStore;

  // Track if we've already attempted to auto-create a notebook
  const autoCreateAttemptedRef = useRef(false);
  const {
    data: notebookData,
    error: notebookError,
    isLoading,
    mutate,
  } = useSWR(
    'workspace/notebooks',
    async () => {
      const { data, error } = await api.v2.notebooks.get();
      if (error)
        throw new Error(typeof error === 'string' ? error : typeof error === 'string' ? error : '');
      return data ?? [];
    },
    {
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    store.getState().setLoading('notebooks', isLoading);
  }, [isLoading, store]);

  useEffect(() => {
    if (notebookError) {
      const s = store.getState();
      s.setConnectionState('error');
      s.setNotebooks([]);
      if (activeNotebookId !== null) {
        s.setActiveNotebook(null);
      }
      s.setError('notebooks', '未连接到后端服务，请检查后重试。');
      return;
    }

    if (!notebookData) return;
    const normalized = notebookData.map(normalizeNotebook);
    const currentActive = activeNotebookId;
    const nextActive = pickDefaultNotebookId(normalized, currentActive);
    const s = store.getState();
    s.setNotebooks(normalized);
    s.setConnectionState('live');
    s.setError('notebooks', '');
    if (nextActive !== currentActive) {
      s.setActiveNotebook(nextActive);
    }
  }, [notebookData, notebookError, activeNotebookId, store]);

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
      store.getState().setCreateState('loading');
      try {
        const { data: created, error: createErr } = await api.v2.notebooks.post({
          name: DEFAULT_NOTEBOOK_NAME,
        });
        if (createErr)
          throw new Error(
            typeof createErr === 'string'
              ? createErr
              : typeof createErr === 'string'
                ? createErr
                : '',
          );
        const newNotebook = created!;
        await mutate(async (current) => (current ? [...current, newNotebook] : [newNotebook]), {
          revalidate: false,
        });
        const normalized = normalizeNotebook(newNotebook);
        const s = store.getState();
        s.setAutoCreatedNotebookId(normalized.id);
        s.setActiveNotebook(normalized.id);
      } catch (error) {
        console.error('Failed to auto-create notebook:', error);
      } finally {
        store.getState().setCreateState('idle');
      }
    };

    void autoCreateNotebook();
  }, [isLoading, mutate, notebookData, notebookError, store]);

  const setActiveNotebookId = useCallback(
    (value: number | null) => {
      if (value === activeNotebookId) return;
      store.getState().setActiveNotebook(value);
    },
    [activeNotebookId, store],
  );

  const setCreateName = useCallback(
    (value: string) => {
      store.getState().setCreateName(value);
    },
    [store],
  );

  const handleCreateNotebook = useCallback(async () => {
    const name = createNameCurrent.trim();
    if (!name || connectionState !== 'live') return false;
    const s = store.getState();
    s.setCreateState('loading');
    s.setError('create', '');
    try {
      const { data: created, error } = await api.v2.notebooks.post({ name });
      if (error)
        throw new Error(typeof error === 'string' ? error : typeof error === 'string' ? error : '');
      const newNotebook = created!;
      await mutate(async (current) => (current ? [...current, newNotebook] : [newNotebook]), {
        revalidate: false,
      });
      const normalized = normalizeNotebook(newNotebook);
      const s2 = store.getState();
      s2.setCreateName('');
      s2.setActiveNotebook(normalized.id);
      return true;
    } catch {
      store.getState().setError('create', '创建失败，请检查后端状态。');
      return false;
    } finally {
      store.getState().setCreateState('idle');
    }
  }, [mutate, connectionState, createNameCurrent, store]);

  const handleCreateNotebookQuick = useCallback(
    async (name?: string) => {
      const finalName = name?.trim() || DEFAULT_NOTEBOOK_NAME;
      if (!finalName || connectionState !== 'live') return false;

      const s = store.getState();
      s.setCreateState('loading');
      s.setError('create', '');

      try {
        const { data: created, error } = await api.v2.notebooks.post({ name: finalName });
        if (error)
          throw new Error(
            typeof error === 'string' ? error : typeof error === 'string' ? error : '',
          );
        const newNotebook = created!;
        await mutate(async (current) => (current ? [...current, newNotebook] : [newNotebook]), {
          revalidate: false,
        });
        const normalized = normalizeNotebook(newNotebook);
        store.getState().setActiveNotebook(normalized.id);
        return true;
      } catch {
        store.getState().setError('create', '创建失败，请检查后端状态。');
        return false;
      } finally {
        store.getState().setCreateState('idle');
      }
    },
    [mutate, connectionState, store],
  );

  const handleCreateNotebookFromTemplate = useCallback(
    async (templateId: number, name: string) => {
      const finalName = name.trim() || DEFAULT_NOTEBOOK_NAME;
      if (!finalName || connectionState !== 'live') return false;

      const s = store.getState();
      s.setCreateState('loading');
      s.setError('create', '');

      try {
        const { data: created, error } = await api.v2.notebooks.post(
          { name: finalName },
          { query: { templateId } },
        );
        if (error)
          throw new Error(
            typeof error === 'string' ? error : typeof error === 'string' ? error : '',
          );
        const newNotebook = created!;
        await mutate(async (current) => (current ? [...current, newNotebook] : [newNotebook]), {
          revalidate: false,
        });
        const normalized = normalizeNotebook(newNotebook);
        store.getState().setActiveNotebook(normalized.id);
        return true;
      } catch {
        store.getState().setError('create', '创建失败，请检查后端状态。');
        return false;
      } finally {
        store.getState().setCreateState('idle');
      }
    },
    [mutate, connectionState, store],
  );

  const retryNotebooks = useCallback(async () => {
    const s = store.getState();
    s.setConnectionState('connecting');
    s.setError('notebooks', '');
    await mutate();
  }, [mutate, store]);

  const handleUpdateNotebook = useCallback(
    async (notebookId: number, name: string) => {
      if (connectionState !== 'live') return false;
      const trimmed = name.trim();
      if (!trimmed) return false;
      try {
        const { data: updated, error } = await api.v2.notebooks({ nid: notebookId }).patch({
          name: trimmed,
        });
        if (error)
          throw new Error(
            typeof error === 'string' ? error : typeof error === 'string' ? error : '',
          );
        const result = updated!;
        const normalized = normalizeNotebook(result);
        await mutate(
          async (current) =>
            current?.map((item) => (item.id === notebookId ? result : item)) ?? [result],
          { revalidate: false },
        );
        store
          .getState()
          .setNotebooks(
            store.getState().notebooks.map((item) => (item.id === notebookId ? normalized : item)),
          );
        return true;
      } catch {
        store.getState().setError('notebooks', '更新笔记本失败，请稍后重试。');
        return false;
      }
    },
    [mutate, connectionState, store],
  );

  const handleDeleteNotebook = useCallback(
    async (notebookId: number) => {
      if (connectionState !== 'live') return false;
      try {
        const { error } = await api.v2.notebooks({ nid: notebookId }).delete();
        if (error)
          throw new Error(
            typeof error === 'string' ? error : typeof error === 'string' ? error : '',
          );
        await mutate(async (current) => current?.filter((item) => item.id !== notebookId) ?? [], {
          revalidate: false,
        });
        const s = store.getState();
        if (s.autoCreatedNotebookId === notebookId) {
          s.setAutoCreatedNotebookId(null);
        }
        const remaining = s.notebooks.filter((item) => item.id !== notebookId);
        s.setNotebooks(remaining);
        if (s.activeNotebookId === notebookId) {
          s.setActiveNotebook(pickDefaultNotebookId(remaining, null));
        }
        return true;
      } catch {
        store.getState().setError('notebooks', '删除笔记本失败，请稍后重试。');
        return false;
      }
    },
    [mutate, connectionState, store],
  );

  const statusLabel = useMemo<StatusLabel>(() => {
    if (connectionState === 'connecting') {
      return { text: '连接中', tone: 'isLoading', tooltip: '正在连接后端服务' };
    }
    if (connectionState === 'error') {
      return { text: '连接失败', tone: 'isError', tooltip: '未连接到后端服务' };
    }
    return { text: '已连接', tone: 'isLive', tooltip: '已连接到后端服务' };
  }, [connectionState]);
  const isConnected = connectionState === 'live';

  return {
    notebooks,
    activeNotebookId,
    setActiveNotebookId,
    createName: createNameCurrent,
    setCreateName,
    createState: createStateCurrent,
    createNotebook: handleCreateNotebook,
    createNotebookQuick: handleCreateNotebookQuick,
    createNotebookFromTemplate: handleCreateNotebookFromTemplate,
    updateNotebook: handleUpdateNotebook,
    deleteNotebook: handleDeleteNotebook,
    statusLabel,
    connectionState,
    notebooksError: errNotebooks,
    createError: errCreate,
    isLoading: loadingNotebooks,
    retryNotebooks,
    isConnected,
  };
}
