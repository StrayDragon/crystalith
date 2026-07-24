/**
 * Eden-backed Lab session — ResearchRun + SSE is authority (default path).
 */
import type {
  ResearchDepth,
  ResearchGraphPatch,
  ResearchProgressEvent,
  ResearchRun,
  ResearchRunStatus,
} from '@crystalith/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { streamRequest } from '../../api/stream';
import { applyGraphPatch } from './applyGraphPatch';
import { confirmHighlightIds } from './confirmHighlight';
import { deriveEdenLabPhase } from './deriveEdenLabPhase';
import { cancelActiveEdenRun } from './edenCancelFlow';
import {
  confirmResearchRun,
  createResearchRun,
  forkResearchNode,
  getResearchRun,
  listProgress,
  patchResearchNode,
  pruneResearchNode,
} from './edenResearchApi';
import { buildEdenCitationsMap } from './evidenceAdapter';
import { LAB_SCENARIOS } from './fake/scenarios';
import type {
  LabCitation,
  LabEdgePathPreset,
  LabLayoutAlgorithm,
  LabLayoutDirection,
  LabNode,
  LabViewMode,
} from './fake/types';
import type { LabController } from './fake/useLabController';
import { DEFAULT_LAB_COMPOSE_DEPTH } from './labComposeDepth';
import {
  computeLabProgressPct,
  countResearchNodeProgress,
  lastProgressSeq,
  mergeProgressBySeq,
  type LabProgressLedgerItem,
} from './labProgressLedger';
import { consumeLabRunNeedsReload } from './labRunReloadGate';
import { deriveLabStateFromRun, isEdenLabPlaying } from './researchGraphAdapter';
import { refreshResearchTasks } from './researchTasksCache';

const EMPTY_MUTATIONS = {
  prunedNodeIds: [] as string[],
  extraNodes: [] as LabNode[],
  extraEdges: [],
  nodeEdits: {},
  activityNotes: [] as string[],
};

const TERMINAL_STATUSES: ReadonlySet<ResearchRunStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
]);

function mergeRunGraph(_prev: ResearchRun | null, next: ResearchRun): ResearchRun {
  return next;
}

export type EdenLabController = LabController & {
  lastError: string;
  /** Eden evidence → LabCitation map (r434); not scenario.citations. */
  citations: Record<string, LabCitation>;
  runId: number | null;
  llmActivity: ResearchRun['llmActivity'];
  reportError: (message: string) => void;
};

function toLedgerItem(ev: ResearchProgressEvent): LabProgressLedgerItem {
  return {
    id: ev.id,
    seq: ev.seq,
    at: ev.at,
    kind: ev.kind,
    nodeId: ev.nodeId ?? null,
    headline: ev.headline ?? null,
    payload: ev.payload ?? null,
  };
}

function sseToLedgerItem(data: {
  seq?: number;
  kind?: string;
  at?: string;
  nodeId?: string;
  headline?: string;
  payload?: Record<string, unknown>;
}): LabProgressLedgerItem | null {
  if (typeof data.seq !== 'number' || !data.kind) return null;
  return {
    id: `sse_${data.seq}`,
    seq: data.seq,
    at: data.at ?? new Date().toISOString(),
    kind: data.kind,
    nodeId: data.nodeId ?? null,
    headline: data.headline ?? null,
    payload: data.payload ?? null,
  };
}

export function useEdenLabController(
  notebookId: number,
  initialRunId?: number | null,
): EdenLabController {
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [progressEvents, setProgressEvents] = useState<LabProgressLedgerItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [topicDraft, setTopicDraft] = useState('');
  const [useNotebookSources, setUseNotebookSources] = useState(false);
  const [allowWeb, setAllowWeb] = useState(true);
  const [depth, setDepth] = useState<ResearchDepth>(DEFAULT_LAB_COMPOSE_DEPTH);
  const [selectedSourceIds, setSelectedSourceIds] = useState<number[]>([]);
  const [confirmChoice, setConfirmChoice] = useState<string | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [viewMode, setViewMode] = useState<LabViewMode>('graph');
  const [layoutDirection, setLayoutDirection] = useState<LabLayoutDirection>('TB');
  const [edgePathPreset, setEdgePathPreset] = useState<LabEdgePathPreset>('smoothstep');
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<LabLayoutAlgorithm>('layered');
  const [reshaping, setReshaping] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<number | null>(null);
  const progressSeqRef = useRef(0);

  const pushLog = useCallback((message: string) => {
    setActivityLog((prev) => [...prev.slice(-80), message]);
  }, []);

  const applyRun = useCallback(
    (next: ResearchRun, note?: string) => {
      setRun(next);
      runIdRef.current = next.id;
      if (note) pushLog(note);
    },
    [pushLog],
  );

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const pullProgress = useCallback(
    async (rid: number, afterSeq = 0) => {
      try {
        const page = await listProgress(notebookId, rid, { afterSeq, limit: 100 });
        const items = page.items.map(toLedgerItem);
        setProgressEvents((prev) => {
          const next = mergeProgressBySeq(afterSeq === 0 ? [] : prev, items);
          progressSeqRef.current = lastProgressSeq(next);
          return next;
        });
      } catch {
        /* progress is best-effort; run graph still works */
      }
    },
    [notebookId],
  );

  const startStream = useCallback(
    (rid: number) => {
      stopStream();
      const ac = new AbortController();
      abortRef.current = ac;
      void (async () => {
        try {
          for await (const ev of streamRequest(
            `/v2/notebooks/${notebookId}/research/${rid}/stream`,
            { signal: ac.signal },
          )) {
            if (ac.signal.aborted) break;
            if (ev.event === 'status') {
              const data = ev.data as { status?: ResearchRunStatus; reason?: string };
              const nextStatus = data.status;
              if (nextStatus && TERMINAL_STATUSES.has(nextStatus)) {
                if (data.reason) pushLog(data.reason);
                else pushLog(`状态 → ${nextStatus}`);
                try {
                  const fresh = await getResearchRun(notebookId, rid);
                  applyRun(fresh);
                } catch {
                  setRun((prev) => (prev ? { ...prev, status: nextStatus } : prev));
                }
                stopStream();
                refreshResearchTasks(notebookId);
                void pullProgress(rid, progressSeqRef.current);
              } else {
                setRun((prev) => (prev ? { ...prev, status: nextStatus ?? prev.status } : prev));
                if (data.reason) pushLog(data.reason);
                else if (nextStatus) pushLog(`状态 → ${nextStatus}`);
                refreshResearchTasks(notebookId);
              }
            } else if (ev.event === 'graph_patch') {
              const patch = ev.data as ResearchGraphPatch;
              setRun((prev) => {
                if (!prev) return prev;
                const g = applyGraphPatch({ nodes: prev.nodes, edges: prev.edges }, patch);
                return { ...prev, nodes: g.nodes, edges: g.edges };
              });
              setReshaping(true);
              window.setTimeout(() => setReshaping(false), 400);
            } else if (ev.event === 'confirm') {
              const data = ev.data as {
                kind?: 'budget' | 'expand_branch';
                branchNodeId?: string;
              };
              setRun((prev) =>
                prev
                  ? {
                      ...prev,
                      status: 'awaiting_confirm',
                      confirmKind: data.kind ?? prev.confirmKind,
                      confirmBranchNodeId: data.branchNodeId ?? prev.confirmBranchNodeId,
                    }
                  : prev,
              );
              pushLog(`等待确认：${data.kind ?? 'confirm'}`);
              refreshResearchTasks(notebookId);
            } else if (ev.event === 'report_ready') {
              pushLog('报告已就绪');
              try {
                const fresh = await getResearchRun(notebookId, rid);
                applyRun(fresh);
              } catch {
                /* ignore refresh errors */
              }
              refreshResearchTasks(notebookId);
            } else if (ev.event === 'log') {
              const data = ev.data as { message?: string };
              if (data.message) pushLog(data.message);
            } else if (ev.event === 'progress') {
              const data = ev.data as {
                seq?: number;
                kind?: string;
                at?: string;
                nodeId?: string;
                headline?: string;
                message?: string;
                payload?: Record<string, unknown>;
              };
              const item = sseToLedgerItem(data);
              if (item) {
                setProgressEvents((prev) => {
                  const next = mergeProgressBySeq(prev, [item]);
                  progressSeqRef.current = lastProgressSeq(next);
                  return next;
                });
                if (item.headline) pushLog(item.headline);
                else pushLog(`进度：${item.kind}`);
              } else if (data.message) {
                pushLog(data.message);
              } else if (data.kind) {
                pushLog(`进度：${data.kind}`);
              }
            } else if (ev.event === 'error') {
              const data = ev.data as { message?: string; errorCode?: string };
              const msg = data.message ?? data.errorCode ?? '流错误';
              setLastError(msg);
              pushLog(msg);
            }
          }
        } catch (error) {
          if (ac.signal.aborted) return;
          const msg = error instanceof Error ? error.message : String(error);
          setLastError(msg);
          pushLog(`SSE：${msg}`);
        } finally {
          // Stream may end without a terminal status event — reconcile UI with GET.
          if (!ac.signal.aborted) {
            try {
              const fresh = await getResearchRun(notebookId, rid);
              applyRun(fresh);
              refreshResearchTasks(notebookId);
              void pullProgress(rid, progressSeqRef.current);
            } catch {
              /* ignore */
            }
          }
        }
      })();
    },
    [applyRun, notebookId, pullProgress, pushLog, stopStream],
  );

  const loadRun = useCallback(
    async (rid: number) => {
      setBusy(true);
      setLastError('');
      try {
        const fresh = await getResearchRun(notebookId, rid);
        applyRun(fresh, `已加载 Run #${rid}`);
        setTopicDraft(fresh.topic);
        setUseNotebookSources(fresh.useNotebookSources);
        setAllowWeb(fresh.allowWeb);
        setDepth(fresh.depth ?? DEFAULT_LAB_COMPOSE_DEPTH);
        setSelectedSourceIds(fresh.sourceIds ?? []);
        progressSeqRef.current = 0;
        setProgressEvents([]);
        await pullProgress(rid, 0);
        if (
          fresh.status === 'queued' ||
          fresh.status === 'running' ||
          fresh.status === 'awaiting_confirm'
        ) {
          startStream(rid);
        } else {
          stopStream();
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setLastError(msg);
        pushLog(msg);
      } finally {
        setBusy(false);
      }
    },
    [applyRun, notebookId, pullProgress, pushLog, startStream, stopStream],
  );

  useEffect(() => {
    if (initialRunId && initialRunId > 0) {
      // J2=B: always loadRun on rid; consume restore gate (idempotent with load)
      consumeLabRunNeedsReload(notebookId, initialRunId);
      void loadRun(initialRunId);
    }
    return () => stopStream();
  }, [initialRunId, loadRun, notebookId, stopStream]);

  const phase = deriveEdenLabPhase({
    status: run?.status ?? null,
    progressEvents,
  });
  const derived = useMemo(() => deriveLabStateFromRun(run, activityLog), [run, activityLog]);
  const researchCounts = useMemo(() => countResearchNodeProgress(run?.nodes ?? []), [run?.nodes]);
  const progressPct = useMemo(
    () =>
      computeLabProgressPct({
        searchesUsed: run?.searchesUsed ?? 0,
        maxSearches: run?.maxSearches ?? 1,
        researchDone: researchCounts.researchDone,
        researchTotal: researchCounts.researchTotal,
        terminal: run?.status === 'completed' || run?.status === 'failed',
      }),
    [run?.searchesUsed, run?.maxSearches, run?.status, researchCounts],
  );

  // H2=B: highlight confirm branch + neighbors while awaiting_confirm
  useEffect(() => {
    if (run?.status !== 'awaiting_confirm') return;
    const branchId = run.confirmBranchNodeId ?? null;
    setHighlightedNodeIds(confirmHighlightIds(branchId, run.edges ?? []));
  }, [run?.status, run?.confirmBranchNodeId, run?.edges]);

  const citations = useMemo(() => {
    const evidenceIds = run?.nodes.flatMap((n) => n.evidenceIds ?? []) ?? [];
    return buildEdenCitationsMap({
      evidences: run?.evidences,
      report: run?.report,
      evidenceIds,
    });
  }, [run]);

  const withBusy = useCallback(
    async (fn: () => Promise<ResearchRun>, note: string) => {
      setBusy(true);
      setLastError('');
      try {
        const next = await fn();
        applyRun(mergeRunGraph(run, next), note);
        refreshResearchTasks(notebookId);
        return next;
      } catch (error) {
        const err = error as Error & { errorCode?: string };
        const base = err instanceof Error ? err.message : String(error);
        const code = typeof err.errorCode === 'string' ? err.errorCode : undefined;
        const msg =
          code === 'RESEARCH_BUDGET' || code === 'RESEARCH_INVALID_STATE'
            ? `[${code}] ${base}`
            : code
              ? `[${code}] ${base}`
              : base;
        setLastError(msg);
        pushLog(msg);
        throw error;
      } finally {
        setBusy(false);
      }
    },
    [applyRun, notebookId, pushLog, run],
  );

  const composeAndStart = useCallback(
    (topic: string) => {
      const trimmed = topic.trim();
      if (!trimmed) return;
      void (async () => {
        setBusy(true);
        setLastError('');
        try {
          progressSeqRef.current = 0;
          setProgressEvents([]);
          const created = await createResearchRun(notebookId, {
            topic: trimmed,
            useNotebookSources,
            allowWeb,
            depth,
            sourceIds: useNotebookSources ? selectedSourceIds : undefined,
          });
          applyRun(created, `已创建 Run #${created.id}`);
          refreshResearchTasks(notebookId);
          setTopicDraft(trimmed);
          await pullProgress(created.id, 0);
          startStream(created.id);
          const url = new URL(window.location.href);
          url.searchParams.set('rid', String(created.id));
          window.history.replaceState(
            { researchLab: true, notebookId, rid: created.id },
            '',
            `${url.pathname}${url.search}`,
          );
          window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          setLastError(msg);
          pushLog(msg);
        } finally {
          setBusy(false);
        }
      })();
    },
    [
      allowWeb,
      applyRun,
      depth,
      notebookId,
      pullProgress,
      pushLog,
      selectedSourceIds,
      startStream,
      useNotebookSources,
    ],
  );

  const pruneAlongEdge = useCallback(
    (edgeId: string) => {
      const edge = derived.edges.find((e) => e.id === edgeId);
      const rid = runIdRef.current;
      if (!edge || !rid) return;
      void withBusy(
        () => pruneResearchNode(notebookId, rid, edge.target),
        `剪枝节点 ${edge.target}`,
      );
    },
    [derived.edges, notebookId, withBusy],
  );

  const forkAlongEdge = useCallback(
    (edgeId: string, draft: { title: string; query?: string; summary?: string }) => {
      const edge = derived.edges.find((e) => e.id === edgeId);
      const rid = runIdRef.current;
      if (!edge || !rid) return;
      const hint = [draft.title, draft.query, draft.summary].filter(Boolean).join(' · ');
      void withBusy(
        () => forkResearchNode(notebookId, rid, edge.target, { hint: hint || undefined }),
        `分叉自 ${edge.target}`,
      );
    },
    [derived.edges, notebookId, withBusy],
  );

  const editNode = useCallback(
    (nodeId: string, patch: Partial<LabNode>) => {
      const rid = runIdRef.current;
      if (!rid) return;
      const body: {
        title?: string;
        query?: string;
        conclusionStatus?: LabNode['conclusionStatus'];
      } = {};
      if (patch.title !== undefined) body.title = patch.title;
      if (patch.query !== undefined) body.query = patch.query;
      if (patch.conclusionStatus !== undefined) body.conclusionStatus = patch.conclusionStatus;
      if (!body.title && body.query === undefined && !body.conclusionStatus) return;
      void withBusy(() => patchResearchNode(notebookId, rid, nodeId, body), `更新节点 ${nodeId}`);
    },
    [notebookId, withBusy],
  );

  const finishReport = useCallback(() => {
    const rid = runIdRef.current;
    if (!rid) return;
    setConfirmChoice('finish_report');
    void withBusy(
      () => confirmResearchRun(notebookId, rid, { action: 'finish_report' }),
      '确认出报告',
    )
      .then(() => setHighlightedNodeIds([]))
      .catch(() => undefined);
  }, [notebookId, withBusy]);

  const continueDig = useCallback(() => {
    const rid = runIdRef.current;
    if (!rid) return;
    setConfirmChoice('continue');
    void withBusy(
      () =>
        confirmResearchRun(notebookId, rid, {
          action: 'continue',
        }),
      '继续研究',
    )
      .then(() => setHighlightedNodeIds([]))
      .catch(() => undefined);
  }, [notebookId, withBusy]);

  const approveBranch = useCallback(() => {
    const rid = runIdRef.current;
    if (!rid) return;
    const branchNodeId = run?.confirmBranchNodeId ?? undefined;
    setConfirmChoice('approve_branch');
    void withBusy(
      () =>
        confirmResearchRun(notebookId, rid, {
          action: 'approve_branch',
          branchNodeId,
        }),
      '批准扩支',
    )
      .then(() => setHighlightedNodeIds([]))
      .catch(() => undefined);
  }, [notebookId, run?.confirmBranchNodeId, withBusy]);

  const skipBranch = useCallback(() => {
    const rid = runIdRef.current;
    if (!rid) return;
    const branchNodeId = run?.confirmBranchNodeId ?? undefined;
    setConfirmChoice('skip_branch');
    void withBusy(
      () =>
        confirmResearchRun(notebookId, rid, {
          action: 'skip_branch',
          branchNodeId,
        }),
      '跳过支路',
    )
      .then(() => setHighlightedNodeIds([]))
      .catch(() => undefined);
  }, [notebookId, run?.confirmBranchNodeId, withBusy]);

  const restart = useCallback(() => {
    stopStream();
    setRun(null);
    runIdRef.current = null;
    setActivityLog([]);
    setProgressEvents([]);
    progressSeqRef.current = 0;
    setTopicDraft('');
    setSelectedNodeId(null);
    setConfirmChoice(null);
    setLastError('');
    const url = new URL(window.location.href);
    url.searchParams.delete('rid');
    window.history.replaceState(
      { researchLab: true, notebookId },
      '',
      `${url.pathname}${url.search}`,
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [notebookId, stopStream]);

  const cancel = useCallback(() => {
    const rid = runIdRef.current;
    if (!rid) return;
    const status = run?.status;
    if (status !== 'queued' && status !== 'running' && status !== 'awaiting_confirm') return;
    // Stop SSE first so late status/graph events cannot overwrite cancelled.
    stopStream();
    void (async () => {
      setBusy(true);
      setLastError('');
      try {
        const next = await cancelActiveEdenRun(notebookId, rid);
        applyRun(next, '已取消研究');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setLastError(msg);
        pushLog(msg);
      } finally {
        setBusy(false);
      }
    })();
  }, [applyRun, notebookId, pushLog, run?.status, stopStream]);

  const focusNodes = useCallback((primaryId: string, highlightIds: string[]) => {
    setSelectedNodeId(primaryId);
    setHighlightedNodeIds(highlightIds);
  }, []);

  const reportError = useCallback(
    (message: string) => {
      setLastError(message);
      pushLog(message);
    },
    [pushLog],
  );

  // LabController-compatible surface (fixture knobs no-op / stubbed).
  return {
    scenarios: LAB_SCENARIOS,
    scenarioId: 'eden',
    setScenarioId: () => undefined,
    phase,
    setPhase: () => undefined,
    playing: isEdenLabPlaying(run?.status),
    setPlaying: () => undefined,
    playbackMs: 1400,
    setPlaybackMs: () => undefined,
    viewMode,
    setViewMode,
    layoutDirection,
    setLayoutDirection,
    edgePathPreset,
    setEdgePathPreset,
    layoutAlgorithm,
    setLayoutAlgorithm,
    selectedNodeId,
    setSelectedNodeId,
    highlightedNodeIds,
    focusNodes,
    consoleOpen,
    setConsoleOpen,
    consoleVisible,
    setConsoleVisible,
    forceStatus: null,
    setForceStatus: () => undefined,
    metricsOverride: null,
    setMetricsOverride: () => undefined,
    topicDraft,
    setTopicDraft,
    useNotebookSources,
    setUseNotebookSources,
    allowWeb,
    setAllowWeb,
    depth,
    setDepth,
    selectedSourceIds,
    setSelectedSourceIds,
    confirmChoice,
    setConfirmChoice,
    mutations: { ...EMPTY_MUTATIONS, activityNotes: activityLog },
    reshaping: reshaping || busy,
    composeAndStart,
    startFromIdle: () => undefined,
    pause: () => undefined,
    resume: () => {
      const rid = runIdRef.current;
      if (rid) startStream(rid);
    },
    cancel,
    finishReport,
    continueDig,
    approveBranch,
    skipBranch,
    retry: () => {
      const rid = runIdRef.current;
      if (rid) void loadRun(rid);
    },
    restart,
    reset: restart,
    pruneAlongEdge,
    forkAlongEdge,
    editNode,
    restoreGraphSlice: () => {
      // Eden: never silent no-op — reload authoritative Run graph (c98 / r451)
      const rid = runIdRef.current;
      if (rid) void loadRun(rid);
    },
    persistNow: () => undefined,
    derived,
    scenario: LAB_SCENARIOS[0]!,
    lastError,
    citations,
    runId: run?.id ?? runIdRef.current,
    llmActivity: run?.llmActivity ?? null,
    reportError,
    progressEvents,
    progressPct,
    searchesUsed: run?.searchesUsed ?? 0,
    maxSearches: run?.maxSearches ?? 0,
    researchDone: researchCounts.researchDone,
    researchTotal: researchCounts.researchTotal,
    confirmKind: run?.status === 'awaiting_confirm' ? (run.confirmKind ?? 'budget') : null,
    confirmBranchNodeId:
      run?.status === 'awaiting_confirm' ? (run.confirmBranchNodeId ?? null) : null,
  };
}

export function readActiveRunIdFromUrl(): number | null {
  if (typeof window === 'undefined') return null;
  const rid = Number(new URL(window.location.href).searchParams.get('rid'));
  return Number.isFinite(rid) && rid > 0 ? rid : null;
}

export function navigateLabWithRun(notebookId: number, runId: number | null): void {
  const path = `/research-lab/${notebookId}`;
  const url = new URL(path, window.location.origin);
  if (runId) url.searchParams.set('rid', String(runId));
  window.history.pushState(
    { researchLab: true, notebookId, rid: runId },
    '',
    `${url.pathname}${url.search}`,
  );
  window.dispatchEvent(new PopStateEvent('popstate'));
}
