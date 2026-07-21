import type { ResearchSession, ResearchSessionDetail, ResearchStatus } from '@crystalith/shared';
import { useCallback, useRef, useState, useEffect } from 'react';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import { streamRequest } from '../../../../api/stream';

export type { ResearchStatus, ResearchSessionDetail };

function toSessionItem(session: ResearchSession): ResearchSessionItem {
  return {
    id: session.id,
    notebookId: session.notebookId,
    topic: session.topic,
    status: session.status,
    currentIteration: session.currentIteration,
    maxIterations: session.maxIterations,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function asResearchStatus(value: unknown): ResearchStatus | null {
  if (
    value === 'planning' ||
    value === 'searching' ||
    value === 'analyzing' ||
    value === 'waiting_user' ||
    value === 'completed' ||
    value === 'cancelled'
  ) {
    return value;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readPlanQueries(
  value: unknown,
): Array<{ query: string; engine: string; priority: number; reason: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    if (typeof item.query !== 'string') return [];
    return [
      {
        query: item.query,
        engine: typeof item.engine === 'string' ? item.engine : '',
        priority: readNumber(item.priority),
        reason: typeof item.reason === 'string' ? item.reason : '',
      },
    ];
  });
}

function toSSEEvent(eventName: string, raw: unknown): SSEEvent | null {
  if (!isRecord(raw)) return null;

  switch (eventName) {
    case 'status': {
      if (typeof raw.status !== 'string') return null;
      const statusData: SSEStatusEvent = {
        status: raw.status,
        iteration: readNumber(raw.iteration),
      };
      if (typeof raw.topic === 'string') statusData.topic = raw.topic;
      return {
        type: 'status',
        data: statusData,
      };
    }
    case 'plan_ready': {
      const nested = isRecord(raw.data) ? raw.data : {};
      return {
        type: 'plan_ready',
        data: {
          iteration: readNumber(raw.iteration),
          data: {
            queries: readPlanQueries(nested.queries),
            reasoning: typeof nested.reasoning === 'string' ? nested.reasoning : '',
          },
        },
      };
    }
    case 'search_progress': {
      const nested = isRecord(raw.data) ? raw.data : {};
      const progressData: SSESearchProgressEvent['data'] = {};
      if (typeof nested.resultCount === 'number') progressData.resultCount = nested.resultCount;
      if (typeof nested.newResults === 'number') progressData.newResults = nested.newResults;
      if (typeof nested.queriesExecuted === 'number') {
        progressData.queriesExecuted = nested.queriesExecuted;
      }
      return {
        type: 'search_progress',
        data: {
          iteration: readNumber(raw.iteration),
          data: progressData,
        },
      };
    }
    case 'analysis': {
      const nested = isRecord(raw.data) ? raw.data : {};
      const analysisData: SSEAnalysisEvent['data'] = {};
      if (typeof nested.summary === 'string') analysisData.summary = nested.summary;
      if (typeof nested.coverageEstimate === 'number') {
        analysisData.coverageEstimate = nested.coverageEstimate;
      }
      if (typeof nested.needMore === 'boolean') analysisData.needMore = nested.needMore;
      return {
        type: 'analysis',
        data: {
          iteration: readNumber(raw.iteration),
          data: analysisData,
        },
      };
    }
    case 'report': {
      const nested = isRecord(raw.data) ? raw.data : {};
      const reportData: SSEReportEvent['data'] = {};
      if (typeof nested.reportLength === 'number') reportData.reportLength = nested.reportLength;
      return {
        type: 'report',
        data: {
          iteration: readNumber(raw.iteration),
          data: reportData,
        },
      };
    }
    case 'done': {
      if (typeof raw.status !== 'string') return null;
      const doneData: SSEDoneEvent = { status: raw.status };
      if (typeof raw.totalResults === 'number') doneData.totalResults = raw.totalResults;
      if (typeof raw.hasReport === 'boolean') doneData.hasReport = raw.hasReport;
      return {
        type: 'done',
        data: doneData,
      };
    }
    case 'waiting': {
      return {
        type: 'waiting',
        data: {
          status: typeof raw.status === 'string' ? raw.status : 'waiting_user',
          iteration: readNumber(raw.iteration),
          message: typeof raw.message === 'string' ? raw.message : '',
        },
      };
    }
    case 'thinking': {
      if (typeof raw.message !== 'string') return null;
      const thinkingData: SSEThinkingEvent = {
        type: typeof raw.type === 'string' ? raw.type : 'thinking',
        message: raw.message,
        iteration: readNumber(raw.iteration),
      };
      if (Array.isArray(raw.queries)) {
        thinkingData.queries = raw.queries.filter(
          (query): query is string => typeof query === 'string',
        );
      }
      return {
        type: 'thinking',
        data: thinkingData,
      };
    }
    case 'connection': {
      if (
        raw.status !== 'reconnecting' &&
        raw.status !== 'reconnected' &&
        raw.status !== 'failed'
      ) {
        return null;
      }
      if (typeof raw.message !== 'string') return null;
      return {
        type: 'connection',
        data: { status: raw.status, message: raw.message },
      };
    }
    case 'error': {
      return {
        type: 'error',
        data: {
          message: typeof raw.message === 'string' ? raw.message : '错误',
        },
      };
    }
    default:
      return null;
  }
}

function appendSseEvent(prev: SSEEvent[], event: SSEEvent, maxEvents: number): SSEEvent[] {
  const next = [...prev, event];
  return next.length > maxEvents ? next.slice(-maxEvents) : next;
}

function toSessionDetail(
  session: ResearchSession | ResearchSessionDetail | null | undefined,
): ResearchSessionDetail | null {
  if (!session) return null;
  return {
    ...session,
    steps: 'steps' in session && Array.isArray(session.steps) ? session.steps : [],
  };
}

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
    resultCount?: number;
    newResults?: number;
    queriesExecuted?: number;
  };
}

interface SSEAnalysisEvent {
  iteration: number;
  data: {
    summary?: string;
    coverageEstimate?: number;
    needMore?: boolean;
  };
}

interface SSEReportEvent {
  iteration: number;
  data: {
    reportLength?: number;
  };
}

interface SSEDoneEvent {
  status: string;
  totalResults?: number;
  hasReport?: boolean;
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

// Session status = shared Zod SSOT (`ResearchStatusSchema`). SSE `error` is an event, not a status.
export interface ResearchSessionItem {
  id: number;
  notebookId: number;
  topic: string;
  status: ResearchStatus;
  currentIteration: number;
  maxIterations: number;
  resultCount?: number;
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
  /** HITL: submit a filtered/edited search plan (POST .../modify). */
  modifySearchPlan: (
    researchId: number,
    plan: {
      iteration: number;
      queries: Array<{ query: string; engine: string; priority: number; reason: string }>;
      reasoning?: string;
      estimatedResults?: number;
    },
  ) => Promise<void>;
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
      const { data, error: fetchErr } = await api.v2.notebooks({ nid: notebookId }).research.get({
        query: { offset: 0, limit: 200 },
      });
      if (fetchErr) throw new Error(parseServerError(fetchErr).message);
      setSessions((data?.items ?? []).map(toSessionItem));
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
        const { data, error: fetchErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ id: researchId })
          .get();
        if (fetchErr) throw new Error(parseServerError(fetchErr).message);
        const detail = toSessionDetail(data);
        setActiveSession(detail);
        return detail;
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
        const { data, error: postErr } = await api.v2.notebooks({ nid: notebookId }).research.post({
          topic,
          maxIterations: maxIterations,
        });
        if (postErr) throw new Error(parseServerError(postErr).message);
        const sessionData = toSessionDetail(data);
        if (!sessionData) throw new Error('创建研究返回空数据');
        setSessions((prev) => [toSessionItem(sessionData), ...prev]);
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
        const { error: deleteErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ id: researchId })
          .delete();
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
        const { data, error: fetchErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ id: researchId })
          .get();
        if (fetchErr) throw new Error(parseServerError(fetchErr).message);
        setActiveSession(toSessionDetail(data));
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
        const { data, error: postErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ id: researchId })
          .approve.post();
        if (postErr) throw new Error(parseServerError(postErr).message);
        if (!data) throw new Error('批准计划失败');
        setActiveSession((prev) => (prev ? { ...prev, status: data.status } : prev));
      } catch (error) {
        setError(error instanceof Error ? error.message : '批准计划失败');
      }
    },
    [notebookId],
  );

  const modifySearchPlan = useCallback(
    async (
      researchId: number,
      plan: {
        iteration: number;
        queries: Array<{ query: string; engine: string; priority: number; reason: string }>;
        reasoning?: string;
        estimatedResults?: number;
      },
    ) => {
      if (!notebookId) return;
      setError('');
      try {
        const { data, error: postErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ id: researchId })
          .modify.post({
            plan: {
              iteration: plan.iteration,
              queries: plan.queries,
              reasoning: plan.reasoning ?? '',
              estimatedResults: plan.estimatedResults ?? 10,
            },
          });
        if (postErr) throw new Error(parseServerError(postErr).message);
        if (!data) throw new Error('修改计划失败');
        setActiveSession((prev) => (prev ? { ...prev, status: data.status } : prev));
      } catch (error) {
        setError(error instanceof Error ? error.message : '修改计划失败');
      }
    },
    [notebookId],
  );

  const skipIteration = useCallback(
    async (researchId: number) => {
      if (!notebookId) return;
      setError('');
      try {
        const { data, error: postErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ id: researchId })
          .skip.post();
        if (postErr) throw new Error(parseServerError(postErr).message);
        if (!data) throw new Error('跳过迭代失败');
        setActiveSession((prev) => (prev ? { ...prev, status: data.status } : prev));
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
        const { data, error: postErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ id: researchId })
          .finish.post();
        if (postErr) throw new Error(parseServerError(postErr).message);
        const status = data?.status ?? 'completed';
        setActiveSession((prev) => (prev ? { ...prev, status } : prev));
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
        const { data, error: postErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ id: researchId })
          .cancel.post();
        if (postErr) throw new Error(parseServerError(postErr).message);
        if (!data) throw new Error('取消研究失败');
        const newStatus = data.status;
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
        const { data, error: postErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ id: researchId })
          .resume.post();
        if (postErr) throw new Error(parseServerError(postErr).message);
        if (!data) throw new Error('继续研究失败');
        setSessions((prev) =>
          prev.map((s) =>
            s.id === researchId
              ? {
                  ...s,
                  status: data.status,
                  currentIteration: data.iteration ?? s.currentIteration,
                }
              : s,
          ),
        );
        // Action result is not a full session — reload detail for Eden-typed steps.
        return await fetchSession(researchId);
      } catch (error) {
        setError(error instanceof Error ? error.message : '继续研究失败');
        return null;
      }
    },
    [fetchSession, notebookId],
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

          const reconnectEvent: SSEEvent = {
            type: 'connection',
            data: {
              status: 'reconnecting',
              message: `${message}${Math.round(delay / 1000)}秒后重连...`,
            },
          };
          setSSEEvents((prev) => appendSseEvent(prev, reconnectEvent, maxSseEvents));

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isResearchSessionActive(currentResearchId)) {
              subscribeToSSE(currentResearchId, true);
            }
          }, delay);
        } else {
          const failedEvent: SSEEvent = {
            type: 'connection',
            data: { status: 'failed', message: '连接失败，请刷新页面重试' },
          };
          setSSEEvents((prev) => appendSseEvent(prev, failedEvent, maxSseEvents));
        }
      };

      const processStream = async () => {
        try {
          const stream = streamRequest(
            `/v2/notebooks/${notebookId}/research/${researchId}/stream`,
            {
              signal: abortController.signal,
            },
          );

          for await (const sseEvent of stream) {
            reconnectAttemptRef.current = 0;
            lastEventAtRef.current = Date.now();

            const parsed = toSSEEvent(sseEvent.event, sseEvent.data);
            if (!parsed) continue;

            setSSEEvents((prev) => appendSseEvent(prev, parsed, maxSseEvents));

            if (parsed.type === 'status') {
              const nextStatus = asResearchStatus(parsed.data.status);
              if (!nextStatus) continue;
              const nextIteration = parsed.data.iteration;
              setActiveSession((prev) =>
                prev
                  ? {
                      ...prev,
                      currentIteration: nextIteration > 0 ? nextIteration : prev.currentIteration,
                      status: nextStatus,
                    }
                  : prev,
              );
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === researchId
                    ? {
                        ...s,
                        currentIteration: nextIteration > 0 ? nextIteration : s.currentIteration,
                        status: nextStatus,
                      }
                    : s,
                ),
              );

              if (!['planning', 'searching', 'analyzing', 'waiting_user'].includes(nextStatus)) {
                unsubscribeFromSSE();
              }
            }

            if (parsed.type === 'done' || parsed.type === 'report') {
              void fetchSession(researchId);
              void fetchSessions();
              if (parsed.type === 'done') {
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
    modifySearchPlan,
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
