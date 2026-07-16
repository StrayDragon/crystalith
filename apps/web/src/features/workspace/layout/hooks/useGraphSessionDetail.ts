import { useCallback, useRef, useState } from 'react';

import { api } from '../../../../api/eden';
import type { ChatMessage, SessionSummary } from '../../shared/types';
import { normalizeMessage } from '../../shared/utils';

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
  const loadedSessionIds = useRef<Set<number>>(new Set());

  const fetchMessages = useCallback(async (notebookId: number, sessionId: number) => {
    if (loadedSessionIds.current.has(sessionId)) return;
    loadedSessionIds.current.add(sessionId);

    setIsLoading(true);
    try {
      const { data, error } = await api.v2
        .notebooks({ nid: notebookId })
        .sessions({ sid: sessionId })
        .messages.get({ query: { offset: 0, limit: 200 } });
      if (error) throw new Error(String(error));
      const msgs = (data ?? []).map((item) =>
        normalizeMessage(item as unknown as Parameters<typeof normalizeMessage>[0]),
      );
      setMessages(msgs);
    } catch {
      // Ignore errors on graph session detail fetch
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openSessionDetail = useCallback((target: GraphSessionTarget) => {
    // eslint-disable-next-line
    const summary: SessionSummary = {
      id: target.id,
      title: target.title ?? '',
      createdAt: target.createdAt ?? '',
      updatedAt: target.updatedAt ?? '',
    };
    setSelectedSession(summary);
    setIsOpen(true);
  }, []);

  const closeSessionDetail = useCallback(() => {
    setIsOpen(false);
    setSelectedSession(null);
    setMessages([]);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  return {
    isOpen,
    selectedSession,
    isFullscreen,
    messages,
    isLoading,
    fetchMessages,
    openSessionDetail,
    closeSessionDetail,
    toggleFullscreen,
  };
}
