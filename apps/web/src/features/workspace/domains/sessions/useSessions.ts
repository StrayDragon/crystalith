import type { Session } from '@crystalith/shared';
import { useCallback, useEffect } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type { SessionSummary } from '../../shared/types';
import { normalizeSession } from '../../shared/utils';

type WorkspaceStoreState = ReturnType<typeof useWorkspaceStore.getState>;

/**
 * Apply a fetched sessions list to the store. SWR mirror effect body, extracted
 * to keep the hook under fallow's complexity gate.
 */
function applySessionsSnapshot(normalized: SessionSummary[]) {
  const s = useWorkspaceStore.getState();
  // Read latest from store — createSession may have set activeId before SWR data lands.
  const activeId = s.activeSessionId;
  s.setSessions(normalized);
  s.setError('sessions', '');
  if (activeId == null) {
    attachSessionOnFirstList(s, normalized);
    return;
  }
  clearSessionIfGone(s, normalized, activeId);
}

/** null → id: attach the newest session, but never mid-send — a wrong-session attach swaps the transcript and drops the optimistic bubble. */
function attachSessionOnFirstList(s: WorkspaceStoreState, normalized: SessionSummary[]) {
  if (!normalized[0] || s.loading.send) return;
  s.setActiveSession(normalized[0].id);
}

/** Active session gone from the server list: clear only when the list is empty (create race may transiently look empty; mid-send never) and no delete handler already switched. */
function clearSessionIfGone(
  s: WorkspaceStoreState,
  normalized: SessionSummary[],
  activeId: number,
) {
  if (normalized.some((item) => item.id === activeId)) return;
  if (normalized.length !== 0 || s.loading.send) return;
  s.setActiveSession(null);
}

export function useSessions() {
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const loadingSessions = useWorkspaceStore((s) => s.loading.sessions);
  const errSessions = useWorkspaceStore((s) => s.errors.sessions);

  const store = useWorkspaceStore;
  const isConnected = connectionState === 'live';

  const { data, error, isLoading, mutate } = useSWR<Session[], Error>(
    activeNotebookId && isConnected ? ['workspace/sessions', activeNotebookId] : null,
    async (): Promise<Session[]> => {
      const { data, error: fetchErr } = await api.v2
        .notebooks({ nid: activeNotebookId! })
        .sessions.get({ query: { offset: 0, limit: 200 } });
      if (fetchErr)
        throw new Error(
          typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
        );
      return data?.items ?? [];
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
      applySessionsSnapshot(data.map(normalizeSession));
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
        if (createErr)
          throw new Error(
            typeof createErr === 'string'
              ? createErr
              : typeof createErr === 'string'
                ? createErr
                : '',
          );
        const newSession = created;
        const normalized = normalizeSession(newSession);
        const s = store.getState();
        // Update local list before switching so the sessions effect cannot fall
        // back to an older session while SWR data is still catching up.
        s.setSessions([normalized, ...s.sessions.filter((item) => item.id !== normalized.id)]);
        s.setActiveSession(normalized.id);
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
        if (updateErr)
          throw new Error(
            typeof updateErr === 'string'
              ? updateErr
              : typeof updateErr === 'string'
                ? updateErr
                : '',
          );
        const result = updated;
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
        if (deleteErr)
          throw new Error(
            typeof deleteErr === 'string'
              ? deleteErr
              : typeof deleteErr === 'string'
                ? deleteErr
                : '',
          );
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
