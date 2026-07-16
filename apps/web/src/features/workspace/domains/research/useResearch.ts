import { useCallback, useRef, useState, useEffect } from 'react';

import { api } from '../../../../api/eden';
import { streamRequest } from '../../../../api/stream';

// SSE Event types
interface SSEStatusEvent {
  status: string;
  iteration: number;
  topic?: string;
}

interface SSEPlanEvent {
  iteration: number;
  data: {
    queries: Array<{ query: string; engine: string; priority: number; reason: string }>;
    reasoning: string;
  };
}

interface SSESearchProgressEvent {
  iteration: number;
  data: {
    result_count?: number;
    new_results?: number;
    queries_executed?: number;
  };
}

interface SSEAnalysisEvent {
  iteration: number;
  data: {
    summary?: string;
    /** v2 agent stores camelCase coverageEstimate */
    coverageEstimate?: number;
    coverage?: number;
    needMore?: boolean;
    need_more_search?: boolean;
  };
}

interface SSEReportEvent {
  iteration: number;
  data: {
    report_length: number;
  };
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

// Eden response types (aligned with ResearchSessionListItem / Response)
export type ResearchStatus =
  | 'planning'
  | 'searching'
  | 'analyzing'
  | 'waiting_user'
  | 'completed'
  | 'cancelled';

export interface ResearchSessionItem {
  id: number;
  notebookId: number;
  topic: string;
  status: string;
  currentIteration: number;
  maxIterations: number;
  result_count?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchSessionDetail {
  id: number;
  notebookId: number;
  topic: string;
  status: string;
  currentIteration: number;
  maxIterations: number;
  aggregatedResults: Array<Record<string, unknown>> | null;
  finalReport: string | null;
  steps?: Array<{
    type: string;
    output_data?: Record<string, unknown> | null;
    iteration: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface UseResearchResult {
  // State
  sessions: ResearchSessionItem[];
  activeSession: ResearchSessionDetail | null;
  isLoading: boolean;
  error: string;
  sseEvents: SSEEvent[];

  // Actions
  fetchSessions: () => Promise<void>;
  fetchSession: (researchId: number) => Promise<ResearchSessionDetail | null>;
  createSession: (topic: string, maxIterations?: number) => Promise<ResearchSessionDetail | null>;
  deleteSession: (researchId: number) => Promise<void>;
  startResearch: (researchId: number) => Promise<void>;
  approveSearchPlan: (researchId: number, feedback?: string) => Promise<void>;
  skipIteration: (researchId: number) => Promise<void>;
  finishResearch: (researchId: number) => Promise<void>;
  cancelResearch: (researchId: number) => Promise<void>;
  resumeResearch: (researchId: number) => Promise<ResearchSessionDetail | null>;
  subscribeToSSE: (researchId: number) => void;
  unsubscribeFromSSE: () => void;
  clearEvents: () => void;
  setActiveSession: (session: ResearchSessionDetail | null) => void;
}

export function useResearch(notebookId: number | undefined): UseResearchResult {
  const [sessions, setSessions] = useState<ResearchSessionItem[]>([]);
  const [activeSession, setActiveSession] = useState<ResearchSessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sseEvents, setSSEEvents] = useState<SSEEvent[]>([]);

  const sessionsRef = useRef<ResearchSessionItem[]>([]);
  const activeSessionRef = useRef<ResearchSessionDetail | null>(null);
  const eventSourceAbortRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const staleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventAtRef = useRef<number>(Date.now());
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 5;
  // 1 second
  const baseReconnectDelay = 1000;
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
      const { data, error: fetchErr } = await api.v2.research.get({
        query: { notebookId: String(notebookId) },
      });
      if (fetchErr)
        throw new Error(
          typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
        );
      setSessions(data as ResearchSessionItem[]);
    } catch (error) {
      setError(error instanceof Error ? error.message : '获取研究列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [notebookId]);

  const fetchSession = useCallback(
    async (researchId: number): Promise<ResearchSessionDetail | null> => {
      if (!notebookId) return null;
      setIsLoading(true);
      setError('');
      try {
        const { data, error: fetchErr } = await api.v2.research({ id: researchId }).get();
        if (fetchErr)
          throw new Error(
            typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
          );
        setActiveSession(data as unknown as ResearchSessionDetail);
        return data as unknown as ResearchSessionDetail;
      } catch (error) {
        setError(error instanceof Error ? error.message : '获取研究详情失败');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [notebookId],
  );

  const createSession = useCallback(
    async (topic: string, maxIterations = 4): Promise<ResearchSessionDetail | null> => {
      if (!notebookId) return null;
      setIsLoading(true);
      setError('');
      try {
        const { data, error: postErr } = await api.v2.research.post({
          topic,
          notebookId: notebookId,
          maxIterations: maxIterations,
        });
        if (postErr)
          throw new Error(
            typeof postErr === 'string' ? postErr : typeof postErr === 'string' ? postErr : '',
          );
        const sessionData = data as unknown as ResearchSessionDetail;
        setSessions((prev) => [
          {
            id: sessionData.id,
            notebookId: sessionData.notebookId,
            topic: sessionData.topic,
            status: sessionData.status,
            currentIteration: sessionData.currentIteration,
            maxIterations: sessionData.maxIterations,
            createdAt: sessionData.createdAt,
            updatedAt: sessionData.createdAt,
          },
          ...prev,
        ]);
        setActiveSession(sessionData);
        return sessionData;
      } catch (error) {
        setError(error instanceof Error ? error.message : '创建研究失败');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [notebookId],
  );

  const deleteSession = useCallback(
    async (researchId: number) => {
      if (!notebookId) return;
      setIsLoading(true);
      setError('');
      try {
        const { error: deleteErr } = await api.v2.research({ id: researchId }).delete();
        if (deleteErr)
          throw new Error(
            typeof deleteErr === 'string'
              ? deleteErr
              : typeof deleteErr === 'string'
                ? deleteErr
                : '删除研究失败',
          );
        setSessions((prev) => prev.filter((s) => s.id !== researchId));
        if (activeSession?.id === researchId) {
          setActiveSession(null);
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : '删除研究失败');
      } finally {
        setIsLoading(false);
      }
    },
    [notebookId, activeSession],
  );

  const startResearch = useCallback(
    async (researchId: number) => {
      if (!notebookId) return;
      setError('');
      try {
        // startResearch in v2 is implicit with POST /research
        const { data, error: fetchErr } = await api.v2.research({ id: researchId }).get();
        if (fetchErr)
          throw new Error(
            typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
          );
        setActiveSession(data as unknown as ResearchSessionDetail);
      } catch (error) {
        setError(error instanceof Error ? error.message : '启动研究失败');
      }
    },
    [notebookId],
  );

  const approveSearchPlan = useCallback(
    async (researchId: number, _feedback?: string) => {
      if (!notebookId) return;
      setError('');
      try {
        const { data, error: postErr } = await api.v2.research({ id: researchId }).approve.post();
        if (postErr)
          throw new Error(
            typeof postErr === 'string' ? postErr : typeof postErr === 'string' ? postErr : '',
          );
        setActiveSession((prev) =>
          prev ? { ...prev, status: (data as unknown as { status: string }).status } : prev,
        );
      } catch (error) {
        setError(error instanceof Error ? error.message : '批准计划失败');
      }
    },
    [notebookId],
  );

  const skipIteration = useCallback(
    async (researchId: number) => {
      if (!notebookId) return;
      setError('');
      try {
        const { data, error: postErr } = await api.v2.research({ id: researchId }).skip.post();
        if (postErr)
          throw new Error(
            typeof postErr === 'string' ? postErr : typeof postErr === 'string' ? postErr : '',
          );
        setActiveSession((prev) =>
          prev ? { ...prev, status: (data as unknown as { status: string }).status } : prev,
        );
      } catch (error) {
        setError(error instanceof Error ? error.message : '跳过迭代失败');
      }
    },
    [notebookId],
  );

  const finishResearch = useCallback(
    async (researchId: number) => {
      if (!notebookId) return;
      setError('');
      try {
        const { error: postErr } = await api.v2.research({ id: researchId }).finish.post();
        if (postErr)
          throw new Error(
            typeof postErr === 'string' ? postErr : typeof postErr === 'string' ? postErr : '',
          );
        setActiveSession((prev) => (prev ? { ...prev, status: 'completed' } : prev));
      } catch (error) {
        setError(error instanceof Error ? error.message : '结束研究失败');
      }
    },
    [notebookId],
  );

  const cancelResearch = useCallback(
    async (researchId: number) => {
      if (!notebookId) return;
      setError('');
      try {
        const { data, error: postErr } = await api.v2.research({ id: researchId }).cancel.post();
        if (postErr)
          throw new Error(
            typeof postErr === 'string' ? postErr : typeof postErr === 'string' ? postErr : '',
          );
        const newStatus = (data as unknown as { status: string }).status;
        setActiveSession((prev) => (prev ? { ...prev, status: newStatus } : prev));
        setSessions((prev) =>
          prev.map((s) => (s.id === researchId ? { ...s, status: newStatus } : s)),
        );
        // Close SSE connection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        eventSourceAbortRef.current?.abort();
        eventSourceAbortRef.current = null;
      } catch (error) {
        setError(error instanceof Error ? error.message : '取消研究失败');
      }
    },
    [notebookId],
  );

  const resumeResearch = useCallback(
    async (researchId: number): Promise<ResearchSessionDetail | null> => {
      if (!notebookId) return null;
      setError('');
      try {
        const { data, error: postErr } = await api.v2.research({ id: researchId }).resume.post();
        if (postErr)
          throw new Error(
            typeof postErr === 'string' ? postErr : typeof postErr === 'string' ? postErr : '',
          );
        const sessionData = data as unknown as ResearchSessionDetail;
        setActiveSession(sessionData);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === researchId
              ? {
                  ...s,
                  status: sessionData.status,
                  currentIteration: sessionData.currentIteration,
                }
              : s,
          ),
        );
        return sessionData;
      } catch (error) {
        setError(error instanceof Error ? error.message : '继续研究失败');
        return null;
      }
    },
    [notebookId],
  );

  const unsubscribeFromSSE = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (staleCheckIntervalRef.current) {
      clearInterval(staleCheckIntervalRef.current);
      staleCheckIntervalRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    eventSourceAbortRef.current?.abort();
    eventSourceAbortRef.current = null;
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

      // Clear pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (staleCheckIntervalRef.current) {
        clearInterval(staleCheckIntervalRef.current);
        staleCheckIntervalRef.current = null;
      }

      // Close existing connection
      eventSourceAbortRef.current?.abort();

      if (!isReconnect) {
        reconnectAttemptRef.current = 0;
      }

      const currentResearchId = researchId;
      const abortController = new AbortController();
      eventSourceAbortRef.current = abortController;
      lastEventAtRef.current = Date.now();

      const scheduleReconnect = (message: string) => {
        if (!isResearchSessionActive(currentResearchId)) return;
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
              {
                type: 'connection',
                data: { status: 'failed', message: '连接失败，请刷新页面重试' },
              },
            ] as SSEEvent[];
            return next.length > maxSseEvents ? next.slice(-maxSseEvents) : next;
          });
        }
      };

      const processStream = async () => {
        try {
          const stream = streamRequest(`/v2/research/${researchId}/stream`, {
            signal: abortController.signal,
          });

          for await (const sseEvent of stream) {
            reconnectAttemptRef.current = 0;
            lastEventAtRef.current = Date.now();

            const eventType = sseEvent.event as SSEEvent['type'];
            const data = sseEvent.data as Record<string, unknown> | null;

            if (!data) continue;

            setSSEEvents((prev) => {
              const next = [...prev, { type: eventType, data } as SSEEvent];
              return next.length > maxSseEvents ? next.slice(-maxSseEvents) : next;
            });

            if (eventType === 'status' && data.status) {
              setActiveSession((prev) =>
                prev
                  ? {
                      ...prev,
                      currentIteration: (data.iteration as number) ?? prev.currentIteration,
                      status: data.status as string,
                    }
                  : prev,
              );
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === researchId
                    ? {
                        ...s,
                        currentIteration: (data.iteration as number) ?? s.currentIteration,
                        status: data.status as string,
                      }
                    : s,
                ),
              );

              if (
                !['planning', 'searching', 'analyzing', 'waiting_user'].includes(
                  data.status as string,
                )
              ) {
                unsubscribeFromSSE();
              }
            }

            if (eventType === 'done' || eventType === 'report') {
              void fetchSession(researchId);
              void fetchSessions();
              if (eventType === 'done') {
                unsubscribeFromSSE();
              }
            }
          }
        } catch {
          if (!abortController.signal.aborted) {
            scheduleReconnect('连接中断，');
          }
        }
      };

      void processStream();

      staleCheckIntervalRef.current = setInterval(() => {
        if (!eventSourceAbortRef.current || eventSourceAbortRef.current.signal.aborted) return;
        const elapsed = Date.now() - lastEventAtRef.current;
        if (elapsed > staleConnectionMs) {
          eventSourceAbortRef.current.abort();
          scheduleReconnect('连接超时，');
        }
      }, staleCheckIntervalMs);
    },
    [notebookId, fetchSession, fetchSessions, isResearchSessionActive, unsubscribeFromSSE],
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
      eventSourceAbortRef.current?.abort();
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
