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
import type { ResearchConclusionStatus } from '@crystalith/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  persistLabSessionSnapshot,
  readLabSessionSnapshot,
  type LabSessionSnapshot,
} from '../labSession';
import { advanceLabPlayback, deriveLabState, EMPTY_MUTATIONS } from './deriveLabState';
import { mockForkSeed } from './mockNodeEnrichment';
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
  confirmChoice: string | null;
  setConfirmChoice: (v: string | null) => void;
  mutations: LabGraphMutations;
  reshaping: boolean;
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
  finishReport: () => void;
  continueDig: () => void;
  retry: () => void;
  restart: () => void;
  /** Flush current state to sessionStorage (call before navigating to report). */
  persistNow: () => void;
}

let forkSeq = 0;

function loadInitial(fallbackScenarioId: string): LabSessionSnapshot {
  const snap = readLabSessionSnapshot();
  if (snap) {
    forkSeq = Math.max(forkSeq, snap.forkSeq ?? 0);
    return snap;
  }
  const scenario = getLabScenario(fallbackScenarioId);
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
    consoleVisible: true,
    forceStatus: null,
    metricsOverride: null,
    confirmChoice: null,
    mutations: EMPTY_MUTATIONS,
    topicDraft: scenario.topic,
    forkSeq: 0,
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
  const [consoleVisible, setConsoleVisible] = useState(initial.consoleVisible ?? true);
  const [forceStatus, setForceStatus] = useState<ResearchConclusionStatus | null>(
    initial.forceStatus,
  );
  const [metricsOverride, setMetricsOverride] = useState<Partial<LabMetrics> | null>(
    initial.metricsOverride,
  );
  const [confirmChoice, setConfirmChoice] = useState<string | null>(initial.confirmChoice);
  const [mutations, setMutations] = useState<LabGraphMutations>(initial.mutations);
  const [reshaping, setReshaping] = useState(false);

  const scenario = useMemo(() => getLabScenario(scenarioId), [scenarioId]);
  const [topicDraft, setTopicDraft] = useState(initial.topicDraft || scenario.topic);

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
    const next = getLabScenario(id);
    setTopicDraft(next.topic);
    setPhase('idle');
    setPlaying(false);
    setSelectedNodeId(null);
    setForceStatus(null);
    setMetricsOverride(null);
    setConfirmChoice(null);
    setMutations(EMPTY_MUTATIONS);
    setViewMode('graph');
    forkSeq = 0;
  }, []);

  const derived = useMemo(
    () => deriveLabState(scenario, phase, { forceStatus, metricsOverride, mutations }),
    [scenario, phase, forceStatus, metricsOverride, mutations],
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
    setTopicDraft(scenario.topic);
  }, [scenario.topic]);

  const startFromIdle = useCallback(() => {
    setForceStatus(null);
    setMetricsOverride(null);
    setConfirmChoice(null);
    setSelectedNodeId(null);
    setMutations(EMPTY_MUTATIONS);
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
    setPhase('completed');
  }, []);

  const continueDig = useCallback(() => {
    setConfirmChoice('continue');
    setPhase('integrate');
    setPlaying(true);
  }, []);

  const retry = useCallback(() => {
    setForceStatus(null);
    setMetricsOverride(null);
    setConfirmChoice(null);
    setSelectedNodeId(null);
    setMutations(EMPTY_MUTATIONS);
    setTopicDraft(scenario.topic);
    setPhase('decompose');
    setPlaying(true);
  }, [scenario.topic]);

  const restart = useCallback(() => {
    setForceStatus(null);
    setMetricsOverride(null);
    setConfirmChoice(null);
    setSelectedNodeId(null);
    setMutations(EMPTY_MUTATIONS);
    setTopicDraft(scenario.topic);
    setPhase('idle');
    setPlaying(false);
  }, [scenario.topic]);

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
    phase,
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
    confirmChoice,
    setConfirmChoice,
    mutations,
    reshaping,
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
    finishReport,
    continueDig,
    retry,
    restart,
    persistNow,
  };
}
