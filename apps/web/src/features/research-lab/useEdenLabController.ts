/**
 * Eden-backed Lab session — ResearchRun + SSE is authority (default path).
 */
import type { ResearchGraphPatch, ResearchRun, ResearchRunStatus } from '@crystalith/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { streamRequest } from '../../api/stream';
import { applyGraphPatch } from './applyGraphPatch';
import {
  confirmResearchRun,
  createResearchRun,
  forkResearchNode,
  getResearchRun,
  patchResearchNode,
  pruneResearchNode,
} from './edenResearchApi';
import { LAB_SCENARIOS } from './fake/scenarios';
import type {
  LabEdgePathPreset,
  LabLayoutAlgorithm,
  LabLayoutDirection,
  LabNode,
  LabViewMode,
} from './fake/types';
import type { LabController } from './fake/useLabController';
import { deriveLabStateFromRun, researchRunStatusToLabPhase } from './researchGraphAdapter';
import { refreshResearchTasks } from './researchTasksCache';

const EMPTY_MUTATIONS = {
  prunedNodeIds: [] as string[],
  extraNodes: [] as LabNode[],
  extraEdges: [],
  nodeEdits: {},
  activityNotes: [] as string[],
};

function mergeRunGraph(prev: ResearchRun | null, next: ResearchRun): ResearchRun {
  return next;
}

export function useEdenLabController(
  notebookId: number,
  initialRunId?: number | null,
): LabController & { lastError: string } {
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [topicDraft, setTopicDraft] = useState('');
  const [useNotebookSources, setUseNotebookSources] = useState(false);
  const [allowWeb, setAllowWeb] = useState(true);
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
              setRun((prev) => (prev ? { ...prev, status: data.status ?? prev.status } : prev));
              if (data.reason) pushLog(data.reason);
              else if (data.status) pushLog(`状态 → ${data.status}`);
              refreshResearchTasks(notebookId);
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
              const data = ev.data as { message?: string; kind?: string };
              if (data.message) pushLog(data.message);
              else if (data.kind) pushLog(`进度：${data.kind}`);
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
        }
      })();
    },
    [applyRun, notebookId, pushLog, stopStream],
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
        setSelectedSourceIds(fresh.sourceIds ?? []);
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
    [applyRun, notebookId, pushLog, startStream, stopStream],
  );

  useEffect(() => {
    if (initialRunId && initialRunId > 0) {
      void loadRun(initialRunId);
    }
    return () => stopStream();
  }, [initialRunId, loadRun, stopStream]);

  const phase = researchRunStatusToLabPhase(run?.status ?? null);
  const derived = useMemo(() => deriveLabStateFromRun(run, activityLog), [run, activityLog]);

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
        const msg = error instanceof Error ? error.message : String(error);
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
          const created = await createResearchRun(notebookId, {
            topic: trimmed,
            useNotebookSources,
            allowWeb,
            sourceIds: useNotebookSources ? selectedSourceIds : undefined,
          });
          applyRun(created, `已创建 Run #${created.id}`);
          refreshResearchTasks(notebookId);
          setTopicDraft(trimmed);
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
    [allowWeb, applyRun, notebookId, pushLog, selectedSourceIds, startStream, useNotebookSources],
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
    );
  }, [notebookId, withBusy]);

  const continueDig = useCallback(() => {
    const rid = runIdRef.current;
    if (!rid) return;
    setConfirmChoice('continue');
    const action = run?.confirmKind === 'expand_branch' ? 'approve_branch' : 'continue';
    void withBusy(
      () =>
        confirmResearchRun(notebookId, rid, {
          action,
          branchNodeId: run?.confirmBranchNodeId ?? undefined,
        }),
      action === 'approve_branch' ? '批准扩支' : '继续研究',
    );
  }, [notebookId, run?.confirmBranchNodeId, run?.confirmKind, withBusy]);

  const restart = useCallback(() => {
    stopStream();
    setRun(null);
    runIdRef.current = null;
    setActivityLog([]);
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

  const focusNodes = useCallback((primaryId: string, highlightIds: string[]) => {
    setSelectedNodeId(primaryId);
    setHighlightedNodeIds(highlightIds);
  }, []);

  // LabController-compatible surface (fixture knobs no-op / stubbed).
  return {
    scenarios: LAB_SCENARIOS,
    scenarioId: 'eden',
    setScenarioId: () => undefined,
    phase,
    setPhase: () => undefined,
    playing: run?.status === 'running' || run?.status === 'queued',
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
    finishReport,
    continueDig,
    retry: () => {
      const rid = runIdRef.current;
      if (rid) void loadRun(rid);
    },
    restart,
    reset: restart,
    pruneAlongEdge,
    forkAlongEdge,
    editNode,
    restoreGraphSlice: () => undefined,
    persistNow: () => undefined,
    derived,
    scenario: LAB_SCENARIOS[0]!,
    lastError,
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
