import { useCallback, useEffect } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { normalizeSession } from '../../shared/utils';

export function useSessions() {
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const loadingSessions = useWorkspaceStore((s) => s.loading.sessions);
  const errSessions = useWorkspaceStore((s) => s.errors.sessions);

  const store = useWorkspaceStore;
  const isConnected = connectionState === 'live';

  const { data, error, isLoading, mutate } = useSWR(
    activeNotebookId && isConnected ? ['workspace/sessions', activeNotebookId] : null,
    async () => {
      const { data, error: fetchErr } = await api.v2
        .notebooks({ nid: activeNotebookId! })
        .sessions.get();
      if (fetchErr) throw new Error(String(fetchErr));
      return data ?? [];
    },
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    store.getState().setLoading('sessions', isLoading);
  }, [isLoading, store]);

  useEffect(() => {
    if (!activeNotebookId) {
      store.getState().setSessions([]);
      return;
    }
    if (!isConnected) {
      const s = store.getState();
      s.setSessions([]);
      s.setActiveSession(null);
      return;
    }
    if (error) {
      store.getState().setError('sessions', '会话加载失败，请稍后重试。');
      return;
    }
    if (data) {
      const normalized = data.map(normalizeSession);
      const activeId = activeSessionId;
      const nextActive =
        normalized.find((item) => item.id === activeId)?.id ?? normalized[0]?.id ?? null;
      const s = store.getState();
      s.setSessions(normalized);
      s.setError('sessions', '');
      if (nextActive !== activeId) {
        s.setActiveSession(nextActive);
      }
    }
  }, [data, error, isConnected, activeNotebookId, activeSessionId, store]);

  const setActiveSessionId = useCallback(
    (sessionId: number | null) => {
      if (sessionId === activeSessionId) return;
      store.getState().setActiveSession(sessionId);
    },
    [activeSessionId, store],
  );

  const handleCreateSession = useCallback(
    async (title?: string | null) => {
      if (!activeNotebookId) return null;
      if (!isConnected) {
        store.getState().setError('sessions', '未连接到后端服务，无法创建会话。');
        return null;
      }
      store.getState().setError('sessions', '');
      try {
        const { data: created, error: createErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sessions.post({
            title: title ?? null,
          });
        if (createErr) throw new Error(String(createErr));
        const newSession = created!;
        const normalized = normalizeSession(newSession);
        store.getState().setActiveSession(normalized.id);
        await mutate(async (current) => (current ? [newSession, ...current] : [newSession]), {
          revalidate: false,
        });
        return normalized.id;
      } catch {
        store.getState().setError('sessions', '创建会话失败，请检查后端状态。');
        return null;
      }
    },
    [isConnected, mutate, activeNotebookId, store],
  );

  const ensureSession = useCallback(
    async (title?: string | null) => {
      if (activeSessionId) return activeSessionId;
      return handleCreateSession(title ?? null);
    },
    [handleCreateSession, activeSessionId],
  );

  const retrySessions = useCallback(async () => {
    store.getState().setError('sessions', '');
    await mutate();
  }, [mutate, store]);

  const refreshSessions = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const handleUpdateSession = useCallback(
    async (sessionId: number, title: string) => {
      if (!activeNotebookId) return false;
      if (!isConnected) {
        store.getState().setError('sessions', '未连接到后端服务，无法更新会话。');
        return false;
      }
      store.getState().setError('sessions', '');
      try {
        const { data: updated, error: updateErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sessions({ sid: sessionId })
          .patch({
            title: title.trim() || undefined,
          });
        if (updateErr) throw new Error(String(updateErr));
        const result = updated!;
        const normalized = normalizeSession(result);
        store
          .getState()
          .setSessions(
            store.getState().sessions.map((item) => (item.id === sessionId ? normalized : item)),
          );
        await mutate(
          async (current) => current?.map((item) => (item.id === sessionId ? result : item)) ?? [],
          { revalidate: false },
        );
        return true;
      } catch {
        store.getState().setError('sessions', '更新会话失败，请稍后重试。');
        return false;
      }
    },
    [isConnected, mutate, activeNotebookId, store],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      if (!activeNotebookId) return false;
      if (!isConnected) {
        store.getState().setError('sessions', '未连接到后端服务，无法删除会话。');
        return false;
      }
      store.getState().setError('sessions', '');
      try {
        const { error: deleteErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sessions({ sid: sessionId })
          .delete();
        if (deleteErr) throw new Error(String(deleteErr));
        const s = store.getState();
        const remaining = s.sessions.filter((item) => item.id !== sessionId);
        s.setSessions(remaining);
        if (s.activeSessionId === sessionId) {
          s.setActiveSession(remaining[0]?.id ?? null);
        }
        await mutate(async (current) => current?.filter((item) => item.id !== sessionId) ?? [], {
          revalidate: false,
        });
        return true;
      } catch {
        store.getState().setError('sessions', '删除会话失败，请稍后重试。');
        return false;
      }
    },
    [isConnected, mutate, activeNotebookId, store],
  );

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession: handleCreateSession,
    updateSession: handleUpdateSession,
    deleteSession: handleDeleteSession,
    ensureSession,
    isLoading: loadingSessions,
    error: errSessions,
    retrySessions,
    refreshSessions,
    isConnected,
  };
}
