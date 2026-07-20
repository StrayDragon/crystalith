/**
 * Deep Research — frontend hook shell (pending full rewrite).
 *
 * Backend only exposes POST …/research → 501. UI chrome stays so SourcesPanel /
 * capsules / detail panels keep compiling; no real sessions, SSE, or HITL.
 *
 * REWRITE MARKER: restore real Eden calls + state once the new runtime exists.
 */
import { useCallback, useState } from 'react';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';

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
  status: ResearchStatus;
  currentIteration: number;
  maxIterations: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchSessionDetail extends ResearchSessionItem {
  // Loose until rewrite — detail/timeline panels still expect rich step/result shapes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub UI shell
  steps: any[];
  finalReport?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub UI shell
  aggregatedResults?: any[] | null;
}

/** Loose SSE shape for thinkingTimeline / detail panel props (REWRITE MARKER). */
export interface SSEEvent {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub UI shell
  data: any;
}

export interface UseResearchResult {
  sessions: ResearchSessionItem[];
  activeSession: ResearchSessionDetail | null;
  isLoading: boolean;
  error: string;
  sseEvents: SSEEvent[];
  fetchSessions: () => Promise<void>;
  fetchSession: (researchId: number) => Promise<ResearchSessionDetail | null>;
  createSession: (topic: string, maxIterations?: number) => Promise<ResearchSessionDetail | null>;
  deleteSession: (researchId: number) => Promise<void>;
  startResearch: (researchId: number) => Promise<void>;
  approveSearchPlan: (researchId: number, feedback?: string) => Promise<void>;
  modifySearchPlan: (researchId: number, plan: Record<string, unknown>) => Promise<void>;
  skipIteration: (researchId: number) => Promise<void>;
  finishResearch: (researchId: number) => Promise<void>;
  cancelResearch: (researchId: number) => Promise<void>;
  resumeResearch: (researchId: number) => Promise<ResearchSessionDetail | null>;
  subscribeToSSE: (researchId: number) => void;
  unsubscribeFromSSE: () => void;
  clearEvents: () => void;
  setActiveSession: (session: ResearchSessionDetail | null) => void;
}

const STUB_MSG = '深度研究尚未实现，等待重写';

export function useResearch(notebookId: number | undefined): UseResearchResult {
  const [activeSession, setActiveSession] = useState<ResearchSessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const stubAction = useCallback((label: string) => {
    setError(`${label}: ${STUB_MSG}`);
  }, []);

  /** Only live call: surfaces backend 501 / STUB_MSG. Never creates a session. */
  const createSession = useCallback(
    async (topic: string, maxIterations = 4): Promise<ResearchSessionDetail | null> => {
      if (!notebookId) return null;
      setIsLoading(true);
      setError('');
      try {
        const { error: postErr } = await api.v2.notebooks({ nid: notebookId }).research.post({
          topic,
          maxIterations,
        });
        setError(postErr ? parseServerError(postErr).message : STUB_MSG);
      } catch (error) {
        setError(error instanceof Error ? error.message : STUB_MSG);
      } finally {
        setIsLoading(false);
      }
      return null;
    },
    [notebookId],
  );

  const fetchSessions = useCallback(async () => {
    /* no list API while stubbed */
  }, []);

  const fetchSession = useCallback(async () => {
    stubAction('获取研究详情');
    return null;
  }, [stubAction]);

  const deleteSession = useCallback(async () => {
    stubAction('删除研究');
  }, [stubAction]);

  const startResearch = useCallback(async () => {
    stubAction('启动研究');
  }, [stubAction]);

  const approveSearchPlan = useCallback(async () => {
    stubAction('批准计划');
  }, [stubAction]);

  const modifySearchPlan = useCallback(async () => {
    stubAction('修改计划');
  }, [stubAction]);

  const skipIteration = useCallback(async () => {
    stubAction('跳过迭代');
  }, [stubAction]);

  const finishResearch = useCallback(async () => {
    stubAction('结束研究');
  }, [stubAction]);

  const cancelResearch = useCallback(async () => {
    stubAction('取消研究');
  }, [stubAction]);

  const resumeResearch = useCallback(async () => {
    stubAction('继续研究');
    return null;
  }, [stubAction]);

  const subscribeToSSE = useCallback(() => {
    stubAction('SSE 订阅');
  }, [stubAction]);

  const unsubscribeFromSSE = useCallback(() => {}, []);
  const clearEvents = useCallback(() => {}, []);

  return {
    sessions: [],
    activeSession,
    isLoading,
    error,
    sseEvents: [],
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
