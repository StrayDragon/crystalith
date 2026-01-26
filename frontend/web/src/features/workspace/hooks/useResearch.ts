import { useCallback, useRef, useState } from 'react';
import {
  createResearchSessionV1NotebooksNotebookIdResearchPost,
  listResearchSessionsV1NotebooksNotebookIdResearchGet,
  getResearchSessionV1NotebooksNotebookIdResearchResearchIdGet,
  deleteResearchSessionV1NotebooksNotebookIdResearchResearchIdDelete,
  startResearchV1NotebooksNotebookIdResearchResearchIdStartPost,
  approveSearchPlanV1NotebooksNotebookIdResearchResearchIdApprovePost,
  finishResearchV1NotebooksNotebookIdResearchResearchIdFinishPost,
  skipIterationV1NotebooksNotebookIdResearchResearchIdSkipPost,
} from '../../../api/client';
import type { ResearchSessionResponse, ResearchSessionListItem, ResearchStatus } from '../../../api/client';

// SSE Event types
interface SSEStatusEvent {
  status: ResearchStatus;
  iteration: number;
  topic?: string;
}

interface SSEPlanEvent {
  plan: {
    queries: Array<{ query: string; engine: string; priority: number; reason: string }>;
    reasoning: string;
  };
  iteration: number;
}

interface SSESearchProgressEvent {
  iteration: number;
  result_count: number;
  new_results: number;
}

interface SSEAnalysisEvent {
  iteration: number;
  summary: string;
  coverage: number;
  need_more_search: boolean;
}

interface SSEReportEvent {
  report_length: number;
}

interface SSEDoneEvent {
  status: string;
  total_results: number;
  has_report: boolean;
}

interface SSEWaitingEvent {
  status: string;
  iteration: number;
  message: string;
}

interface SSEThinkingEvent {
  type: string;
  message: string;
  iteration: number;
  queries?: string[];
}

export type SSEEvent =
  | { type: 'status'; data: SSEStatusEvent }
  | { type: 'plan_ready'; data: SSEPlanEvent }
  | { type: 'search_progress'; data: SSESearchProgressEvent }
  | { type: 'analysis'; data: SSEAnalysisEvent }
  | { type: 'report'; data: SSEReportEvent }
  | { type: 'done'; data: SSEDoneEvent }
  | { type: 'waiting'; data: SSEWaitingEvent }
  | { type: 'thinking'; data: SSEThinkingEvent }
  | { type: 'error'; data: { message: string } };

interface UseResearchResult {
  // State
  sessions: ResearchSessionListItem[];
  activeSession: ResearchSessionResponse | null;
  isLoading: boolean;
  error: string;
  sseEvents: SSEEvent[];

  // Actions
  fetchSessions: () => Promise<void>;
  fetchSession: (researchId: number) => Promise<void>;
  createSession: (topic: string, maxIterations?: number) => Promise<ResearchSessionResponse | null>;
  deleteSession: (researchId: number) => Promise<void>;
  startResearch: (researchId: number) => Promise<void>;
  approveSearchPlan: (researchId: number, feedback?: string) => Promise<void>;
  skipIteration: (researchId: number) => Promise<void>;
  finishResearch: (researchId: number) => Promise<void>;
  subscribeToSSE: (researchId: number) => void;
  unsubscribeFromSSE: () => void;
  clearEvents: () => void;
  setActiveSession: (session: ResearchSessionResponse | null) => void;
}

export function useResearch(notebookId: number | undefined): UseResearchResult {
  const [sessions, setSessions] = useState<ResearchSessionListItem[]>([]);
  const [activeSession, setActiveSession] = useState<ResearchSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sseEvents, setSSEEvents] = useState<SSEEvent[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!notebookId) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await listResearchSessionsV1NotebooksNotebookIdResearchGet({
        path: { notebook_id: notebookId },
      });
      if (response.data) {
        setSessions(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取研究列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [notebookId]);

  const fetchSession = useCallback(
    async (researchId: number) => {
      if (!notebookId) return;
      setIsLoading(true);
      setError('');
      try {
        const response = await getResearchSessionV1NotebooksNotebookIdResearchResearchIdGet({
          path: { notebook_id: notebookId, research_id: researchId },
        });
        if (response.data) {
          setActiveSession(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取研究详情失败');
      } finally {
        setIsLoading(false);
      }
    },
    [notebookId]
  );

  const createSession = useCallback(
    async (topic: string, maxIterations = 4): Promise<ResearchSessionResponse | null> => {
      if (!notebookId) return null;
      setIsLoading(true);
      setError('');
      try {
        const response = await createResearchSessionV1NotebooksNotebookIdResearchPost({
          path: { notebook_id: notebookId },
          body: { topic, max_iterations: maxIterations },
        });
        if (response.data) {
          const data = response.data;
          setSessions((prev) => [
            {
              id: data.id,
              notebook_id: data.notebook_id,
              topic: data.topic,
              status: data.status,
              current_iteration: data.current_iteration,
              max_iterations: data.max_iterations,
              created_at: data.created_at,
              updated_at: data.created_at, // Use created_at as initial updated_at
            },
            ...prev,
          ]);
          setActiveSession(data);
          return data;
        }
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : '创建研究失败');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [notebookId]
  );

  const deleteSession = useCallback(
    async (researchId: number) => {
      if (!notebookId) return;
      setIsLoading(true);
      setError('');
      try {
        await deleteResearchSessionV1NotebooksNotebookIdResearchResearchIdDelete({
          path: { notebook_id: notebookId, research_id: researchId },
        });
        setSessions((prev) => prev.filter((s) => s.id !== researchId));
        if (activeSession?.id === researchId) {
          setActiveSession(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '删除研究失败');
      } finally {
        setIsLoading(false);
      }
    },
    [notebookId, activeSession]
  );

  const startResearch = useCallback(
    async (researchId: number) => {
      if (!notebookId) return;
      setError('');
      try {
        const response = await startResearchV1NotebooksNotebookIdResearchResearchIdStartPost({
          path: { notebook_id: notebookId, research_id: researchId },
        });
        if (response.data) {
          setActiveSession(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '启动研究失败');
      }
    },
    [notebookId]
  );

  const approveSearchPlan = useCallback(
    async (researchId: number, feedback?: string) => {
      if (!notebookId) return;
      setError('');
      try {
        const response = await approveSearchPlanV1NotebooksNotebookIdResearchResearchIdApprovePost({
          path: { notebook_id: notebookId, research_id: researchId },
          body: { feedback },
        });
        if (response.data) {
          setActiveSession(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '批准计划失败');
      }
    },
    [notebookId]
  );

  const skipIteration = useCallback(
    async (researchId: number) => {
      if (!notebookId) return;
      setError('');
      try {
        const response = await skipIterationV1NotebooksNotebookIdResearchResearchIdSkipPost({
          path: { notebook_id: notebookId, research_id: researchId },
        });
        if (response.data) {
          setActiveSession(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '跳过迭代失败');
      }
    },
    [notebookId]
  );

  const finishResearch = useCallback(
    async (researchId: number) => {
      if (!notebookId) return;
      setError('');
      try {
        const response = await finishResearchV1NotebooksNotebookIdResearchResearchIdFinishPost({
          path: { notebook_id: notebookId, research_id: researchId },
        });
        if (response.data) {
          setActiveSession(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '结束研究失败');
      }
    },
    [notebookId]
  );

  const subscribeToSSE = useCallback(
    (researchId: number) => {
      if (!notebookId) return;

      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const url = `/v1/notebooks/${notebookId}/research/${researchId}/stream`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      const handleEvent = (eventType: SSEEvent['type']) => (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          setSSEEvents((prev) => [...prev, { type: eventType, data } as SSEEvent]);

          // Update session state from SSE events for real-time progress
          if (eventType === 'status' && data.iteration && data.status) {
            // Update activeSession
            setActiveSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                current_iteration: data.iteration,
                status: data.status,
              };
            });
            // Also update sessions list for capsule display
            setSessions((prev) =>
              prev.map((s) =>
                s.id === researchId
                  ? { ...s, current_iteration: data.iteration, status: data.status }
                  : s
              )
            );
          }

          // Full refresh on done or report to get final data
          if (eventType === 'done' || eventType === 'report') {
            fetchSession(researchId);
            // Also refresh sessions list
            fetchSessions();
          }
        } catch {
          console.error('Failed to parse SSE event:', event.data);
        }
      };

      eventSource.addEventListener('status', handleEvent('status'));
      eventSource.addEventListener('plan_ready', handleEvent('plan_ready'));
      eventSource.addEventListener('search_progress', handleEvent('search_progress'));
      eventSource.addEventListener('analysis', handleEvent('analysis'));
      eventSource.addEventListener('report', handleEvent('report'));
      eventSource.addEventListener('done', handleEvent('done'));
      eventSource.addEventListener('waiting', handleEvent('waiting'));
      eventSource.addEventListener('thinking', handleEvent('thinking'));

      eventSource.onerror = () => {
        setSSEEvents((prev) => [...prev, { type: 'error', data: { message: '连接中断' } }]);
        eventSource.close();
      };
    },
    [notebookId, fetchSession, fetchSessions]
  );

  const unsubscribeFromSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const clearEvents = useCallback(() => {
    setSSEEvents([]);
  }, []);

  return {
    sessions,
    activeSession,
    isLoading,
    error,
    sseEvents,
    fetchSessions,
    fetchSession,
    createSession,
    deleteSession,
    startResearch,
    approveSearchPlan,
    skipIteration,
    finishResearch,
    subscribeToSSE,
    unsubscribeFromSSE,
    clearEvents,
    setActiveSession,
  };
}
