/**
 * Shared Lab controller surface — implemented by Eden (`useEdenLabController`)
 * and demo fixture (`useLabController`). Types come from product `model/`, not
 * demo `typeof` / `ReturnType` coupling.
 */
import type { ResearchConclusionStatus, ResearchDepth } from '@crystalith/shared';

import type { LabProgressLedgerItem } from '../labProgressLedger';
import type { LabConfirmKind } from './resolveLabPrimaryAction';
import type {
  LabDerivedState,
  LabEdgePathPreset,
  LabGraphMutations,
  LabLayoutAlgorithm,
  LabLayoutDirection,
  LabMetrics,
  LabNode,
  LabPhase,
  LabScenario,
  LabViewMode,
} from './types';

export interface LabController {
  scenarios: LabScenario[];
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
  derived: LabDerivedState;
  scenario: LabScenario;
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
