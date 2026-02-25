import { useCallback, useRef, useState, useEffect } from 'react';
import {
  createResearchSessionV1NotebooksNotebookIdResearchPost,
  listResearchSessionsV1NotebooksNotebookIdResearchGet,
  getResearchSessionV1NotebooksNotebookIdResearchResearchIdGet,
  deleteResearchSessionV1NotebooksNotebookIdResearchResearchIdDelete,
  startResearchV1NotebooksNotebookIdResearchResearchIdStartPost,
  approveSearchPlanV1NotebooksNotebookIdResearchResearchIdApprovePost,
  finishResearchV1NotebooksNotebookIdResearchResearchIdFinishPost,
  skipIterationV1NotebooksNotebookIdResearchResearchIdSkipPost,
  cancelResearchV1NotebooksNotebookIdResearchResearchIdCancelPost,
  resumeResearchV1NotebooksNotebookIdResearchResearchIdResumePost,
  type ResearchSessionResponse,
  type ResearchSessionListItem,
  type ResearchStatus,
} from '../../../../api/generated';
import { unwrapData } from '../../../../api/unwrap';

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

interface SSEConnectionEvent {
  status: 'reconnecting' | 'reconnected' | 'failed';
  message: string;
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
  | { type: 'connection'; data: SSEConnectionEvent }
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
  fetchSession: (researchId: number) => Promise<ResearchSessionResponse | null>;
  createSession: (topic: string, maxIterations?: number) => Promise<ResearchSessionResponse | null>;
  deleteSession: (researchId: number) => Promise<void>;
  startResearch: (researchId: number) => Promise<void>;
  approveSearchPlan: (researchId: number, feedback?: string) => Promise<void>;
  skipIteration: (researchId: number) => Promise<void>;
  finishResearch: (researchId: number) => Promise<void>;
  cancelResearch: (researchId: number) => Promise<void>;
  resumeResearch: (researchId: number) => Promise<ResearchSessionResponse | null>;
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

  const sessionsRef = useRef<ResearchSessionListItem[]>([]);
  const activeSessionRef = useRef<ResearchSessionResponse | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const staleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventAtRef = useRef<number>(Date.now());
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second
  const maxSseEvents = 500;
  const staleConnectionMs = 45000;
  const staleCheckIntervalMs = 5000;

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const fetchSessions = useCallback(async () => {
    if (!notebookId) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await unwrapData(listResearchSessionsV1NotebooksNotebookIdResearchGet<true>({
        path: { notebook_id: notebookId },
      }));
      setSessions(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取研究列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [notebookId]);

  const fetchSession = useCallback(
    async (researchId: number): Promise<ResearchSessionResponse | null> => {
      if (!notebookId) return null;
      setIsLoading(true);
      setError('');
      try {
        const response = await unwrapData(getResearchSessionV1NotebooksNotebookIdResearchResearchIdGet<true>({
          path: { notebook_id: notebookId, research_id: researchId },
        }));
        setActiveSession(response);
        return response;
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取研究详情失败');
        return null;
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
        const data = await unwrapData(createResearchSessionV1NotebooksNotebookIdResearchPost<true>({
          path: { notebook_id: notebookId },
          body: { topic, max_iterations: maxIterations },
        }));
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
        await deleteResearchSessionV1NotebooksNotebookIdResearchResearchIdDelete<true>({
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
        const response = await unwrapData(startResearchV1NotebooksNotebookIdResearchResearchIdStartPost<true>({
          path: { notebook_id: notebookId, research_id: researchId },
        }));
        setActiveSession(response);
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
        const response = await unwrapData(approveSearchPlanV1NotebooksNotebookIdResearchResearchIdApprovePost<true>({
          path: { notebook_id: notebookId, research_id: researchId },
          body: { feedback },
        }));
        setActiveSession(response);
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
        const response = await unwrapData(skipIterationV1NotebooksNotebookIdResearchResearchIdSkipPost<true>({
          path: { notebook_id: notebookId, research_id: researchId },
        }));
        setActiveSession(response);
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
        const response = await unwrapData(finishResearchV1NotebooksNotebookIdResearchResearchIdFinishPost<true>({
          path: { notebook_id: notebookId, research_id: researchId },
        }));
        setActiveSession(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : '结束研究失败');
      }
    },
    [notebookId]
  );

  // Cancel research - marks as cancelled without generating report
  const cancelResearch = useCallback(
    async (researchId: number) => {
      if (!notebookId) return;
      setError('');
      try {
        const response = await unwrapData(cancelResearchV1NotebooksNotebookIdResearchResearchIdCancelPost<true>({
          path: { notebook_id: notebookId, research_id: researchId },
        }));
        setActiveSession(response);
        // Update sessions list
        setSessions((prev) =>
          prev.map((s) => (s.id === researchId ? { ...s, status: response.status } : s)),
        );
        // Close SSE connection when cancelled
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '取消研究失败');
      }
    },
    [notebookId]
  );

  const resumeResearch = useCallback(
    async (researchId: number): Promise<ResearchSessionResponse | null> => {
      if (!notebookId) return null;
      setError('');
      try {
        const response = await unwrapData(resumeResearchV1NotebooksNotebookIdResearchResearchIdResumePost<true>({
          path: { notebook_id: notebookId, research_id: researchId },
        }));
        setActiveSession(response);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === researchId
              ? {
                  ...s,
                  status: response.status,
                  current_iteration: response.current_iteration,
                }
              : s,
          ),
        );
        return response;
      } catch (err) {
        setError(err instanceof Error ? err.message : '继续研究失败');
        return null;
      }
    },
    [notebookId]
  );

  const unsubscribeFromSSE = useCallback(() => {
    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (staleCheckIntervalRef.current) {
      clearInterval(staleCheckIntervalRef.current);
      staleCheckIntervalRef.current = null;
    }
    // Reset reconnect attempts
    reconnectAttemptRef.current = 0;
    // Close connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const isResearchSessionActive = useCallback((researchId: number) => {
    const session = sessionsRef.current.find((s) => s.id === researchId);
    if (session) {
      return ['planning', 'searching', 'analyzing', 'waiting_user'].includes(session.status);
    }
    const active = activeSessionRef.current;
    if (active?.id === researchId) {
      return ['planning', 'searching', 'analyzing', 'waiting_user'].includes(active.status);
    }
    return false;
  }, []);

  const subscribeToSSE = useCallback(
    (researchId: number, isReconnect = false) => {
      if (!notebookId) return;

      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (staleCheckIntervalRef.current) {
        clearInterval(staleCheckIntervalRef.current);
        staleCheckIntervalRef.current = null;
      }

      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Reset reconnect attempts on fresh subscription
      if (!isReconnect) {
        reconnectAttemptRef.current = 0;
      }

      const url = `/v1/notebooks/${notebookId}/research/${researchId}/stream`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;
      lastEventAtRef.current = Date.now();

      // Track current research ID for reconnection
      const currentResearchId = researchId;

      const scheduleReconnect = (message: string) => {
        if (!isResearchSessionActive(currentResearchId)) {
          return;
        }
        // Check if we should attempt reconnection
        if (reconnectAttemptRef.current < maxReconnectAttempts) {
          reconnectAttemptRef.current += 1;
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptRef.current - 1);

          setSSEEvents((prev) => {
            const next = [
              ...prev,
              {
                type: 'connection',
                data: {
                  status: 'reconnecting',
                  message: `${message}${Math.round(delay / 1000)}秒后重连...`,
                },
              },
            ] as SSEEvent[];
            return next.length > maxSseEvents ? next.slice(-maxSseEvents) : next;
          });

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isResearchSessionActive(currentResearchId)) {
              subscribeToSSE(currentResearchId, true);
            }
          }, delay);
        } else {
          setSSEEvents((prev) => {
            const next = [
              ...prev,
              { type: 'connection', data: { status: 'failed', message: '连接失败，请刷新页面重试' } },
            ] as SSEEvent[];
            return next.length > maxSseEvents ? next.slice(-maxSseEvents) : next;
          });
        }
      };

      const handleEvent = (eventType: SSEEvent['type']) => (event: MessageEvent) => {
        // Reset reconnect attempts on successful event
        reconnectAttemptRef.current = 0;
        lastEventAtRef.current = Date.now();

        try {
          const data = JSON.parse(event.data);
          setSSEEvents((prev) => {
            const next = [...prev, { type: eventType, data } as SSEEvent];
            return next.length > maxSseEvents ? next.slice(-maxSseEvents) : next;
          });

          // Update session state from SSE events for real-time progress
          if (eventType === 'status' && data.status) {
            // Update activeSession with iteration if provided
            setActiveSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                current_iteration: data.iteration ?? prev.current_iteration,
                status: data.status,
              };
            });
            // Also update sessions list for capsule display
            setSessions((prev) =>
              prev.map((s) =>
                s.id === researchId
                  ? {
                      ...s,
                      current_iteration: data.iteration ?? s.current_iteration,
                      status: data.status
                    }
                  : s
              )
            );

            if (!['planning', 'searching', 'analyzing', 'waiting_user'].includes(data.status)) {
              unsubscribeFromSSE();
            }
          }

          // Update iteration from thinking events that include new_iteration type
          if (eventType === 'thinking' && data.type === 'new_iteration' && data.iteration) {
            setActiveSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                current_iteration: data.iteration,
              };
            });
            setSessions((prev) =>
              prev.map((s) =>
                s.id === researchId
                  ? { ...s, current_iteration: data.iteration }
                  : s
              )
            );
          }

          // Update from analysis events which include iteration info
          if (eventType === 'analysis' && data.iteration) {
            setActiveSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                current_iteration: data.iteration,
              };
            });
            setSessions((prev) =>
              prev.map((s) =>
                s.id === researchId
                  ? { ...s, current_iteration: data.iteration }
                  : s
              )
            );
          }

          // Full refresh on done or report to get final data
          if (eventType === 'done' || eventType === 'report') {
            fetchSession(researchId);
            // Also refresh sessions list
            fetchSessions();
            if (eventType === 'done') {
              unsubscribeFromSSE();
            }
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
      eventSource.addEventListener('heartbeat', () => {
        lastEventAtRef.current = Date.now();
      });

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;
        scheduleReconnect('连接中断，');
      };

      // Handle successful connection
      eventSource.onopen = () => {
        lastEventAtRef.current = Date.now();
        if (isReconnect) {
          if (import.meta.env.DEV) {
            console.log('SSE reconnected successfully');
          }
          setSSEEvents((prev) => {
            const next = [
              ...prev,
              { type: 'connection', data: { status: 'reconnected', message: '连接已恢复' } },
            ] as SSEEvent[];
            return next.length > maxSseEvents ? next.slice(-maxSseEvents) : next;
          });
          // Refresh session data after reconnect
          fetchSession(researchId);
        }
      };

      staleCheckIntervalRef.current = setInterval(() => {
        if (!eventSourceRef.current) return;
        const elapsed = Date.now() - lastEventAtRef.current;
        if (elapsed > staleConnectionMs) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
          scheduleReconnect('连接超时，');
        }
      }, staleCheckIntervalMs);
    },
    [notebookId, fetchSession, fetchSessions, isResearchSessionActive, unsubscribeFromSSE]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (staleCheckIntervalRef.current) {
        clearInterval(staleCheckIntervalRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
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
    cancelResearch,
    resumeResearch,
    subscribeToSSE,
    unsubscribeFromSSE,
    clearEvents,
    setActiveSession,
  };
}
