import { useCallback, useEffect } from "react";
import useSWR from "swr";

import {
  createSessionV1NotebooksNotebookIdSessionsPost as createSession,
  deleteSessionV1NotebooksNotebookIdSessionsSessionIdDelete as deleteSession,
  listSessionsV1NotebooksNotebookIdSessionsGet as listSessions,
  updateSessionV1NotebooksNotebookIdSessionsSessionIdPatch as updateSession,
} from "../../../../api/generated";
import { unwrapData } from "../../../../api/unwrap";
import { useWorkspaceStore } from "../../shared/state/workspaceStore";
import type { ApiSession } from "../../shared/types";
import { normalizeSession } from "../../shared/utils";

export function useSessions() {
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const loadingSessions = useWorkspaceStore((s) => s.loading.sessions);
  const errSessions = useWorkspaceStore((s) => s.errors.sessions);

  const store = useWorkspaceStore;
  const isConnected = connectionState === "live";

  const { data, error, isLoading, mutate } = useSWR(
    activeNotebookId && isConnected ? ["workspace/sessions", activeNotebookId] : null,
    () => unwrapData(listSessions<true>({ path: { notebook_id: activeNotebookId ?? 0 } })),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    store.getState().setLoading("sessions", isLoading);
  }, [isLoading]);

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
      store.getState().setError("sessions", "会话加载失败，请稍后重试。");
      return;
    }
    if (data) {
      const normalized = data.map(normalizeSession);
      const activeId = activeSessionId;
      const nextActive =
        normalized.find((item) => item.id === activeId)?.id ?? normalized[0]?.id ?? null;
      const s = store.getState();
      s.setSessions(normalized);
      s.setError("sessions", "");
      if (nextActive !== activeId) {
        s.setActiveSession(nextActive);
      }
    }
  }, [data, error, isConnected, activeNotebookId, activeSessionId]);

  const setActiveSessionId = useCallback(
    (sessionId: number | null) => {
      if (sessionId === activeSessionId) return;
      store.getState().setActiveSession(sessionId);
    },
    [activeSessionId],
  );

  const handleCreateSession = useCallback(
    async (title?: string | null) => {
      if (!activeNotebookId) return null;
      if (!isConnected) {
        store.getState().setError("sessions", "未连接到后端服务，无法创建会话。");
        return null;
      }
      store.getState().setError("sessions", "");
      try {
        const created = await unwrapData(
          createSession<true>({
            path: { notebook_id: activeNotebookId },
            body: { title: title ?? null },
          }),
        );
        const normalized = normalizeSession(created);
        store.getState().setActiveSession(normalized.id);
        await mutate(async (current) => (current ? [created, ...current] : [created]), {
          revalidate: false,
        });
        return normalized.id;
      } catch (error) {
        store.getState().setError("sessions", "创建会话失败，请检查后端状态。");
        return null;
      }
    },
    [isConnected, mutate, activeNotebookId],
  );

  const ensureSession = useCallback(
    async (title?: string | null) => {
      if (activeSessionId) return activeSessionId;
      return handleCreateSession(title ?? null);
    },
    [handleCreateSession, activeSessionId],
  );

  const retrySessions = useCallback(async () => {
    store.getState().setError("sessions", "");
    await mutate();
  }, [mutate]);

  const refreshSessions = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const handleUpdateSession = useCallback(
    async (sessionId: number, title: string) => {
      if (!activeNotebookId) return false;
      if (!isConnected) {
        store.getState().setError("sessions", "未连接到后端服务，无法更新会话。");
        return false;
      }
      store.getState().setError("sessions", "");
      try {
        const updated = await unwrapData(
          updateSession<true>({
            path: { notebook_id: activeNotebookId, session_id: sessionId },
            body: { title: title.trim() || undefined },
          }),
        );
        const normalized = normalizeSession(updated);
        store
          .getState()
          .setSessions(
            store.getState().sessions.map((item) => (item.id === sessionId ? normalized : item)),
          );
        await mutate(
          async (current) => current?.map((item) => (item.id === sessionId ? updated : item)) ?? [],
          { revalidate: false },
        );
        return true;
      } catch (error) {
        store.getState().setError("sessions", "更新会话失败，请稍后重试。");
        return false;
      }
    },
    [isConnected, mutate, activeNotebookId],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      if (!activeNotebookId) return false;
      if (!isConnected) {
        store.getState().setError("sessions", "未连接到后端服务，无法删除会话。");
        return false;
      }
      store.getState().setError("sessions", "");
      try {
        await unwrapData(
          deleteSession<true>({
            path: { notebook_id: activeNotebookId, session_id: sessionId },
          }),
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
      } catch (error) {
        store.getState().setError("sessions", "删除会话失败，请稍后重试。");
        return false;
      }
    },
    [isConnected, mutate, activeNotebookId],
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
