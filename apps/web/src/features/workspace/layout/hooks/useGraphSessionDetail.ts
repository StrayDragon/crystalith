import { useCallback } from 'react';

import { api } from '../../../../api/eden';

interface GraphMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  updated_at: string;
}

interface GraphSessionDetail {
  messages: GraphMessage[];
  session_id: number;
  title: string | null;
}

export function useGraphSessionDetail() {
  const fetchMessages = useCallback(
    async (notebookId: number, sessionId: number): Promise<GraphSessionDetail | null> => {
      try {
        const { data, error } = await api.v2
          .notebooks({ nid: notebookId })
          .sessions({ sid: sessionId })
          .messages.get();
        if (error) throw error;
        return {
          messages: (data ?? []) as GraphMessage[],
          session_id: sessionId,
          title: null,
        };
      } catch {
        return null;
      }
    },
    [],
  );

  return { fetchMessages };
}
