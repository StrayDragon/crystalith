import { useCallback, useRef, useState } from "react";

import { listMessagesV1NotebooksNotebookIdSessionsSessionIdMessagesGet as listMessages } from "../../../../api/generated";
import { unwrapData } from "../../../../api/unwrap";
import type { ChatMessage, SessionSummary } from "../../shared/types";
import { normalizeMessage } from "../../shared/utils";

export interface GraphSessionTarget {
  id: number;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useGraphSessionDetail() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const closeSessionDetail = useCallback(() => {
    requestIdRef.current += 1;
    setIsOpen(false);
    setIsFullscreen(false);
    setMessages([]);
    setIsLoading(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const openSessionDetail = useCallback(
    async (session: GraphSessionTarget, notebookId: number | null) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setSelectedSession({
        id: session.id,
        title: session.title || `对话 ${session.id}`,
        createdAt: session.createdAt || "",
        updatedAt: session.updatedAt || "",
      });
      setIsOpen(true);
      setIsFullscreen(false);
      setMessages([]);

      if (!notebookId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await unwrapData(
          listMessages<true>({
            path: { notebook_id: notebookId, session_id: session.id },
          }),
        );
        if (requestIdRef.current !== requestId) return;
        setMessages(response.map(normalizeMessage));
      } catch {
        if (requestIdRef.current !== requestId) return;
        setMessages([]);
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  return {
    isOpen,
    selectedSession,
    isFullscreen,
    messages,
    isLoading,
    openSessionDetail,
    closeSessionDetail,
    toggleFullscreen,
  };
}
