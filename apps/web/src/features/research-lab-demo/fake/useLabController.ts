/**
 * MOCK Lab controller — local state + sessionStorage.
 *
 * Real swap map:
 * - `mutations` / prune/fork → Eden prune/fork + apply `graph_patch`
 * - `phase` / playback → ResearchRun.status + SSE status/confirm
 * - `derived` → run.graph (nodes/edges) after patch reduce
 * - `reshaping` → optional FE animation after topology patch
 * - `forceStatus` / console knobs → remove or gate behind DEV
 *
 * Prune semantics MUST match server `collectResearchPruneClosure` (r316).
 */
import type { ResearchConclusionStatus, ResearchDepth } from '@crystalith/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { confirmHighlightIds } from '../../research-lab/confirmHighlight';
import {
  deriveEdenLabPhase,
  fixturePlaybackToRunStatus,
} from '../../research-lab/deriveEdenLabPhase';
import { DEFAULT_LAB_COMPOSE_DEPTH } from '../../research-lab/labComposeDepth';
import {
  appendFixturePhaseEvent,
  computeLabProgressPct,
  countResearchNodeProgress,
  fixtureBudgetFromSources,
  type LabProgressLedgerItem,
} from '../../research-lab/labProgressLedger';
import { consumeComposeTopicFromUrl } from '../../research-lab/labRouting';
import {
  persistLabSessionSnapshot,
  readLabSessionSnapshot,
  type LabSessionSnapshot,
} from '../labSession';
import { advanceLabPlayback, deriveLabState, EMPTY_MUTATIONS } from './deriveLabState';
import { mockForkSeed } from './mockNodeEnrichment';
import type { LabConfirmKind } from './resolveLabPrimaryAction';
import { getLabScenario, LAB_SCENARIOS } from './scenarios';
import type {
  LabEdge,
  LabEdgePathPreset,
  LabGraphMutations,
  LabLayoutAlgorithm,
  LabLayoutDirection,
  LabMetrics,
  LabNode,
  LabPhase,
  LabViewMode,
} from './types';
import { LAB_PHASE_LABELS } from './types';

export interface LabController {
  scenarios: typeof LAB_SCENARIOS;
  scenarioId: string;
  setScenarioId: (id: string) => void;
  phase: LabPhase;
  setPhase: (phase: LabPhase) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  playbackMs: number;
  setPlaybackMs: (ms: number) => void;
  viewMode: LabViewMode;
  setViewMode: (m: LabViewMode) => void;
  layoutDirection: LabLayoutDirection;
  setLayoutDirection: (d: LabLayoutDirection) => void;
  edgePathPreset: LabEdgePathPreset;
  setEdgePathPreset: (p: LabEdgePathPreset) => void;
  layoutAlgorithm: LabLayoutAlgorithm;
  setLayoutAlgorithm: (a: LabLayoutAlgorithm) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  highlightedNodeIds: string[];
  /** Select primary node and soft-highlight related nodes (citation locate). */
  focusNodes: (primaryId: string, highlightIds: string[]) => void;
  consoleOpen: boolean;
  setConsoleOpen: (v: boolean) => void;
  /** Whether the floating console is shown at all (header show/hide). */
  consoleVisible: boolean;
  setConsoleVisible: (v: boolean) => void;
  forceStatus: ResearchConclusionStatus | null;
  setForceStatus: (s: ResearchConclusionStatus | null) => void;
  metricsOverride: Partial<LabMetrics> | null;
  setMetricsOverride: (m: Partial<LabMetrics> | null) => void;
  topicDraft: string;
  setTopicDraft: (v: string) => void;
  useNotebookSources: boolean;
  setUseNotebookSources: (v: boolean) => void;
  allowWeb: boolean;
  setAllowWeb: (v: boolean) => void;
  depth: ResearchDepth;
  setDepth: (v: ResearchDepth) => void;
  /** Compose model (Eden); fixture ignores. */
  modelId: string | null;
  setModelId: (v: string | null) => void;
  selectedSourceIds: number[];
  setSelectedSourceIds: (ids: number[]) => void;
  confirmChoice: string | null;
  setConfirmChoice: (v: string | null) => void;
  mutations: LabGraphMutations;
  reshaping: boolean;
  /** Idle compose → apply topic to root and start fixture playback. */
  composeAndStart: (topic: string) => void;
  pruneAlongEdge: (edgeId: string) => void;
  forkAlongEdge: (
    edgeId: string,
    draft: { title: string; query?: string; summary?: string },
  ) => void;
  editNode: (nodeId: string, patch: Partial<LabNode>) => void;
  /** Restore graph slice from a saved LabRevision. */
  restoreGraphSlice: (slice: {
    phase: LabPhase;
    mutations: LabGraphMutations;
    topicDraft: string;
    forkSeq: number;
    forceStatus: ResearchConclusionStatus | null;
  }) => void;
  derived: ReturnType<typeof deriveLabState>;
  scenario: ReturnType<typeof getLabScenario>;
  reset: () => void;
  startFromIdle: () => void;
  pause: () => void;
  resume: () => void;
  /** Eden: POST cancel; fixture: no-op. */
  cancel: () => void;
  finishReport: () => void;
  continueDig: () => void;
  /** Proactive search budget add-on (c108); fixture demo is local-only. */
  addBudget: () => void;
  /** M1 expand_branch (c96). */
  approveBranch: () => void;
  skipBranch: () => void;
  retry: () => void;
  restart: () => void;
  /** Flush current state to sessionStorage (call before navigating to report). */
  persistNow: () => void;
  /** Progress ledger (Eden HTTP/SSE or fixture synthetic) — c95. */
  progressEvents: LabProgressLedgerItem[];
  progressPct: number;
  searchesUsed: number;
  maxSearches: number;
  researchDone: number;
  researchTotal: number;
  /** M1 confirm kind (c96); null when not awaiting. */
  confirmKind: LabConfirmKind | null;
  confirmBranchNodeId: string | null;
}

let forkSeq = 0;

function loadInitial(fallbackScenarioId: string): LabSessionSnapshot {
  const snap = readLabSessionSnapshot();
  if (snap) {
    forkSeq = Math.max(forkSeq, snap.forkSeq ?? 0);
    return snap;
  }
  return {
    scenarioId: fallbackScenarioId,
    phase: 'idle',
    playing: false,
    playbackMs: 1400,
    layoutDirection: 'TB',
    edgePathPreset: 'smoothstep',
    layoutAlgorithm: 'layered',
    selectedNodeId: null,
    highlightedNodeIds: [],
    consoleOpen: false,
    consoleVisible: false,
    forceStatus: null,
    metricsOverride: null,
    confirmChoice: null,
    mutations: EMPTY_MUTATIONS,
    topicDraft: '',
    forkSeq: 0,
    useNotebookSources: false,
    allowWeb: true,
    selectedSourceIds: [],
  };
}

export function useLabController(initialScenarioId = 'xlsx-lib'): LabController {
  const initial = useMemo(() => loadInitial(initialScenarioId), [initialScenarioId]);

  const [scenarioId, setScenarioIdState] = useState(initial.scenarioId);
  const [phase, setPhase] = useState<LabPhase>(initial.phase);
  const [playing, setPlaying] = useState(false);
  const [playbackMs, setPlaybackMs] = useState(initial.playbackMs);
  const [viewMode, setViewMode] = useState<LabViewMode>('graph');
  const [layoutDirection, setLayoutDirection] = useState<LabLayoutDirection>(
    initial.layoutDirection,
  );
  const [edgePathPreset, setEdgePathPreset] = useState<LabEdgePathPreset>(
    initial.edgePathPreset ?? 'smoothstep',
  );
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<LabLayoutAlgorithm>(
    initial.layoutAlgorithm ?? 'layered',
  );
  const [selectedNodeId, setSelectedNodeIdState] = useState<string | null>(initial.selectedNodeId);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>(
    initial.highlightedNodeIds ?? [],
  );
  const setSelectedNodeId = useCallback((id: string | null) => {
    setSelectedNodeIdState(id);
    setHighlightedNodeIds((prev) => (prev.length === 0 ? prev : []));
  }, []);
  const focusNodes = useCallback((primaryId: string, highlightIds: string[]) => {
    setSelectedNodeIdState(primaryId);
    setHighlightedNodeIds(highlightIds);
  }, []);
  const [consoleOpen, setConsoleOpen] = useState(initial.consoleOpen);
  const [consoleVisible, setConsoleVisible] = useState(initial.consoleVisible ?? false);
  const [forceStatus, setForceStatus] = useState<ResearchConclusionStatus | null>(
    initial.forceStatus,
  );
  const [metricsOverride, setMetricsOverride] = useState<Partial<LabMetrics> | null>(
    initial.metricsOverride,
  );
  const [confirmChoice, setConfirmChoice] = useState<string | null>(initial.confirmChoice);
  const [mutations, setMutations] = useState<LabGraphMutations>(initial.mutations);
  const [reshaping, setReshaping] = useState(false);
  const [progressEvents, setProgressEvents] = useState<LabProgressLedgerItem[]>([]);
  const [confirmKind, setConfirmKind] = useState<LabConfirmKind | null>(null);
  const [confirmBranchNodeId, setConfirmBranchNodeId] = useState<string | null>(null);

  const scenario = useMemo(() => getLabScenario(scenarioId), [scenarioId]);
  const [topicDraft, setTopicDraft] = useState(initial.topicDraft ?? '');
  const [useNotebookSources, setUseNotebookSources] = useState(initial.useNotebookSources ?? false);
  const [allowWeb, setAllowWeb] = useState(initial.allowWeb ?? true);
  const [depth, setDepth] = useState<ResearchDepth>(DEFAULT_LAB_COMPOSE_DEPTH);
  const [modelId, setModelId] = useState<string | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<number[]>(
    initial.selectedSourceIds ?? [],
  );

  // c99 K6=A: fixture also consumes ?topic= for Compose prefill
  useEffect(() => {
    const topic = consumeComposeTopicFromUrl();
    if (topic) setTopicDraft(topic);
  }, []);

  const buildSnapshot = useCallback((): LabSessionSnapshot => {
    return {
      scenarioId,
      phase,
      playing: false,
      playbackMs,
      layoutDirection,
      edgePathPreset,
      layoutAlgorithm,
      selectedNodeId,
      highlightedNodeIds,
      consoleOpen,
      consoleVisible,
      forceStatus,
      metricsOverride,
      confirmChoice,
      mutations,
      topicDraft,
      forkSeq,
      useNotebookSources,
      allowWeb,
      selectedSourceIds,
    };
  }, [
    scenarioId,
    phase,
    playbackMs,
    layoutDirection,
    edgePathPreset,
    layoutAlgorithm,
    selectedNodeId,
    highlightedNodeIds,
    consoleOpen,
    consoleVisible,
    forceStatus,
    metricsOverride,
    confirmChoice,
    mutations,
    topicDraft,
    useNotebookSources,
    allowWeb,
    selectedSourceIds,
  ]);

  const persistNow = useCallback(() => {
    persistLabSessionSnapshot(buildSnapshot());
  }, [buildSnapshot]);

  // Keep sessionStorage in sync so returning from report restores graph.
  useEffect(() => {
    persistLabSessionSnapshot(buildSnapshot());
  }, [buildSnapshot]);

  const triggerReshape = useCallback(() => {
    setReshaping(true);
    window.setTimeout(() => setReshaping(false), 900);
  }, []);

  const setScenarioId = useCallback((id: string) => {
    setScenarioIdState(id);
    setTopicDraft('');
    setPhase('idle');
    setPlaying(false);
    setSelectedNodeId(null);
    setForceStatus(null);
    setMetricsOverride(null);
    setConfirmChoice(null);
    setMutations(EMPTY_MUTATIONS);
    setViewMode('graph');
    setSelectedSourceIds([]);
    setProgressEvents([]);
    forkSeq = 0;
  }, []);

  const derived = useMemo(
    () => deriveLabState(scenario, phase, { forceStatus, metricsOverride, mutations }),
    [scenario, phase, forceStatus, metricsOverride, mutations],
  );

  useEffect(() => {
    setProgressEvents((prev) => appendFixturePhaseEvent(prev, phase, LAB_PHASE_LABELS[phase]));
  }, [phase]);

  useEffect(() => {
    if (phase !== 'awaiting_confirm') {
      setConfirmKind(null);
      setConfirmBranchNodeId(null);
      return;
    }
    const research = derived.nodes.find(
      (n) => n.role === 'research' && n.conclusionStatus !== 'pruned',
    );
    if (research) {
      setConfirmKind('expand_branch');
      setConfirmBranchNodeId(research.id);
      setHighlightedNodeIds(confirmHighlightIds(research.id, derived.edges));
    } else {
      setConfirmKind('budget');
      setConfirmBranchNodeId(null);
      setHighlightedNodeIds([]);
    }
  }, [phase, derived.nodes, derived.edges]);

  const researchCounts = useMemo(() => countResearchNodeProgress(derived.nodes), [derived.nodes]);
  const fixtureBudget = useMemo(
    () => fixtureBudgetFromSources(derived.metrics.sourcesRetrieved),
    [derived.metrics.sourcesRetrieved],
  );
  const progressPct = useMemo(
    () =>
      computeLabProgressPct({
        ...fixtureBudget,
        ...researchCounts,
        terminal: phase === 'completed' || phase === 'failed',
      }),
    [fixtureBudget, researchCounts, phase],
  );

  // I3=B: display phase from shared derive + synthetic ledger (not raw timer alone)
  const displayPhase = useMemo(
    () =>
      deriveEdenLabPhase({
        status: fixturePlaybackToRunStatus(phase),
        progressEvents,
      }),
    [phase, progressEvents],
  );

  const askOnInterruptRef = useRef(true);
  askOnInterruptRef.current =
    derived.nodes.find((n) => n.role === 'question' || n.id === 'root')?.askOnInterrupt !== false;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => {
        setPhase((prev) => {
          const step = advanceLabPlayback(prev, askOnInterruptRef.current);
          setPlaying(step.playing);
          return step.phase;
        });
      },
      Math.max(400, playbackMs),
    );
    return () => window.clearInterval(timer);
  }, [playing, playbackMs]);

  const reset = useCallback(() => {
    setPhase('idle');
    setPlaying(false);
    setSelectedNodeId(null);
    setForceStatus(null);
    setMetricsOverride(null);
    setConfirmChoice(null);
    setMutations(EMPTY_MUTATIONS);
    setTopicDraft('');
    setProgressEvents([]);
  }, []);

  const startFromIdle = useCallback(() => {
    setForceStatus(null);
    setMetricsOverride(null);
    setConfirmChoice(null);
    setSelectedNodeId(null);
    setPhase('decompose');
    setPlaying(true);
  }, []);

  const composeAndStart = useCallback((topic: string) => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    // Demo main path: lock fixture to xlsx-lib until Eden create (c82).
    setScenarioIdState('xlsx-lib');
    setTopicDraft(trimmed);
    setForceStatus(null);
    setMetricsOverride(null);
    setConfirmChoice(null);
    setSelectedNodeId(null);
    setMutations({
      ...EMPTY_MUTATIONS,
      nodeEdits: {
        root: {
          title: trimmed.slice(0, 48),
          query: trimmed,
          conclusion: trimmed,
        },
      },
      activityNotes: [`创建演示任务：${trimmed.slice(0, 64)}${trimmed.length > 64 ? '…' : ''}`],
    });
    setProgressEvents([]);
    setPhase('decompose');
    setPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setPlaying(false);
  }, []);

  const resume = useCallback(() => {
    setPlaying(true);
  }, []);

  const finishReport = useCallback(() => {
    setConfirmChoice('finish_report');
    setPlaying(false);
    setHighlightedNodeIds([]);
    setPhase('completed');
  }, []);

  const continueDig = useCallback(() => {
    setConfirmChoice('continue');
    setHighlightedNodeIds([]);
    setPhase('integrate');
    setPlaying(true);
  }, []);

  const addBudget = useCallback(() => {
    setConfirmChoice('add_budget');
    setHighlightedNodeIds([]);
    setPlaying(true);
  }, []);

  const approveBranch = useCallback(() => {
    setConfirmChoice('approve_branch');
    setHighlightedNodeIds([]);
    setPhase('integrate');
    setPlaying(true);
  }, []);

  const skipBranch = useCallback(() => {
    setConfirmChoice('skip_branch');
    setHighlightedNodeIds([]);
    setPhase('integrate');
    setPlaying(true);
  }, []);

  const retry = useCallback(() => {
    setForceStatus(null);
    setMetricsOverride(null);
    setConfirmChoice(null);
    setSelectedNodeId(null);
    setMutations((prev) => {
      const next: LabGraphMutations = {
        ...EMPTY_MUTATIONS,
        activityNotes: ['重试演示回放'],
      };
      if (prev.nodeEdits.root) {
        next.nodeEdits = { root: prev.nodeEdits.root };
      }
      return next;
    });
    setPhase('decompose');
    setPlaying(true);
  }, []);

  const restart = useCallback(() => {
    setForceStatus(null);
    setMetricsOverride(null);
    setConfirmChoice(null);
    setSelectedNodeId(null);
    setMutations(EMPTY_MUTATIONS);
    setPhase('idle');
    setPlaying(false);
  }, []);

  const pruneAlongEdge = useCallback(
    (edgeId: string) => {
      const edge = derived.edges.find((e) => e.id === edgeId);
      if (!edge) return;
      const target = derived.nodes.find((n) => n.id === edge.target);
      if (!target || target.role === 'question' || target.role === 'conclusion') return;
      setMutations((prev) => {
        if (prev.prunedNodeIds.includes(edge.target)) return prev;
        return {
          ...prev,
          prunedNodeIds: [...prev.prunedNodeIds, edge.target],
          activityNotes: [
            ...prev.activityNotes,
            `剪枝：沿边「${edge.labelNote ?? edge.kind}」淡化支路 ${edge.target}（汇入保留为失败）`,
          ],
        };
      });
      if (selectedNodeId === edge.target) setSelectedNodeId(null);
      triggerReshape();
    },
    [derived.edges, derived.nodes, selectedNodeId, triggerReshape],
  );

  const forkAlongEdge = useCallback(
    (edgeId: string, draft: { title: string; query?: string; summary?: string }) => {
      const edge = derived.edges.find((e) => e.id === edgeId);
      if (!edge) return;
      const target = derived.nodes.find((n) => n.id === edge.target);
      // Only fork research branches; never fork into a second conclusion.
      if (target?.role === 'conclusion' || target?.role === 'question') return;
      if (edge.target === 'conclusion' || edge.source === 'conclusion') return;

      const title = draft.title.trim();
      if (!title) return;

      forkSeq += 1;
      const newId = `fork-${forkSeq}`;
      const conclusionId = derived.conclusionNodeId;

      const seed = mockForkSeed({
        title,
        query: draft.query?.trim(),
        siblingTitle: target?.title,
      });
      const newNode: LabNode = {
        id: newId,
        role: 'research',
        title,
        query: draft.query?.trim() || undefined,
        summary: draft.summary?.trim() || seed.summary,
        conclusion: seed.conclusion,
        conclusionStatus: seed.conclusionStatus,
        phase: seed.phase,
        citationIds: [],
      };
      const newEdges: LabEdge[] = [
        {
          id: `e-${newId}`,
          source: edge.source,
          target: newId,
          kind: 'fork',
          labelNote: '分叉',
        },
      ];
      if (conclusionId) {
        newEdges.push({
          id: `e-${newId}-merge`,
          source: newId,
          target: conclusionId,
          kind: 'merge',
          labelNote: '汇入',
        });
      }

      setMutations((prev) => ({
        ...prev,
        extraNodes: [...prev.extraNodes, newNode],
        extraEdges: [...prev.extraEdges, ...newEdges],
        activityNotes: [
          ...prev.activityNotes,
          `分叉：自 ${edge.source} 新增「${title}」(${newId})${conclusionId ? ' → 汇入唯一结论' : ''}`,
        ],
      }));
      setSelectedNodeId(newId);
      triggerReshape();
    },
    [derived.edges, derived.nodes, derived.conclusionNodeId, triggerReshape],
  );

  const editNode = useCallback(
    (nodeId: string, patch: Partial<LabNode>) => {
      const keys = Object.keys(patch).filter((k) => k !== 'id') as Array<keyof LabNode>;
      const configOnly = keys.length > 0 && keys.every((k) => k === 'askOnInterrupt');
      /** Query change reshapes the research graph; prose-only edits do not. */
      const needsReshape = keys.includes('query');
      const hasStatus = keys.includes('conclusionStatus');
      setMutations((prev) => ({
        ...prev,
        nodeEdits: {
          ...prev.nodeEdits,
          [nodeId]: { ...prev.nodeEdits[nodeId], ...patch, id: nodeId },
        },
        activityNotes: [
          ...prev.activityNotes,
          configOnly
            ? `更新提问配置 ${nodeId} · askOnInterrupt=${String(patch.askOnInterrupt)}`
            : hasStatus
              ? `定态节点 ${nodeId} · status=${String(patch.conclusionStatus)}`
              : needsReshape
                ? `编辑节点 ${nodeId} · query 变更触发流程重塑`
                : `编辑节点 ${nodeId} · 仅更新文案`,
        ],
      }));
      if (needsReshape) triggerReshape();
      if (hasStatus) triggerReshape();
    },
    [triggerReshape],
  );

  const restoreGraphSlice = useCallback(
    (slice: {
      phase: LabPhase;
      mutations: LabGraphMutations;
      topicDraft: string;
      forkSeq: number;
      forceStatus: ResearchConclusionStatus | null;
    }) => {
      setPhase(slice.phase);
      setMutations(slice.mutations ?? EMPTY_MUTATIONS);
      setTopicDraft(slice.topicDraft);
      setForceStatus(slice.forceStatus);
      forkSeq = Math.max(forkSeq, slice.forkSeq ?? 0);
      setPlaying(false);
      setConfirmChoice(null);
      triggerReshape();
    },
    [triggerReshape],
  );

  return {
    scenarios: LAB_SCENARIOS,
    scenarioId,
    setScenarioId,
    phase: displayPhase,
    setPhase,
    playing,
    setPlaying,
    playbackMs,
    setPlaybackMs,
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
    forceStatus,
    setForceStatus,
    metricsOverride,
    setMetricsOverride,
    topicDraft,
    setTopicDraft,
    useNotebookSources,
    setUseNotebookSources,
    allowWeb,
    setAllowWeb,
    depth,
    setDepth,
    modelId,
    setModelId,
    selectedSourceIds,
    setSelectedSourceIds,
    confirmChoice,
    setConfirmChoice,
    mutations,
    reshaping,
    composeAndStart,
    pruneAlongEdge,
    forkAlongEdge,
    editNode,
    restoreGraphSlice,
    derived,
    scenario,
    reset,
    startFromIdle,
    pause,
    resume,
    cancel: () => undefined,
    finishReport,
    continueDig,
    addBudget,
    approveBranch,
    skipBranch,
    retry,
    restart,
    persistNow,
    progressEvents,
    progressPct,
    searchesUsed: fixtureBudget.searchesUsed,
    maxSearches: fixtureBudget.maxSearches,
    researchDone: researchCounts.researchDone,
    researchTotal: researchCounts.researchTotal,
    confirmKind,
    confirmBranchNodeId,
  };
}
