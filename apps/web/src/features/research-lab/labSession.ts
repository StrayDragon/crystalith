import type { ResearchConclusionStatus } from '@crystalith/shared';

import { EMPTY_MUTATIONS } from './fake/deriveLabState';
import type {
  LabEdgePathPreset,
  LabGraphMutations,
  LabLayoutAlgorithm,
  LabLayoutDirection,
  LabMetrics,
  LabPhase,
} from './fake/types';

const LAB_SCENARIO_STORAGE_KEY = 'crystalith.research-lab.scenarioId';
const LAB_SESSION_STORAGE_KEY = 'crystalith.research-lab.session';

/** Full graph session so returning from report restores nodes/mutations/phase. */
export interface LabSessionSnapshot {
  scenarioId: string;
  phase: LabPhase;
  playing: boolean;
  playbackMs: number;
  layoutDirection: LabLayoutDirection;
  /** xyflow edge path preset (smoothstep / bezier / …). */
  edgePathPreset: LabEdgePathPreset;
  /** ELK algorithm preset. */
  layoutAlgorithm: LabLayoutAlgorithm;
  selectedNodeId: string | null;
  /** Soft multi-select from citation locate (subset may include selectedNodeId). */
  highlightedNodeIds: string[];
  consoleOpen: boolean;
  consoleVisible: boolean;
  forceStatus: ResearchConclusionStatus | null;
  metricsOverride: Partial<LabMetrics> | null;
  confirmChoice: string | null;
  mutations: LabGraphMutations;
  topicDraft: string;
  forkSeq: number;
  /** Compose: mirror ResearchCreate channels (demo until Eden create). */
  useNotebookSources: boolean;
  allowWeb: boolean;
  selectedSourceIds: number[];
}

export function persistLabScenarioId(scenarioId: string): void {
  try {
    sessionStorage.setItem(LAB_SCENARIO_STORAGE_KEY, scenarioId);
  } catch {
    /* ignore */
  }
}

export function readPersistedLabScenarioId(fallback = 'xlsx-lib'): string {
  try {
    return sessionStorage.getItem(LAB_SCENARIO_STORAGE_KEY) ?? fallback;
  } catch {
    return fallback;
  }
}

export function persistLabSessionSnapshot(snap: LabSessionSnapshot): void {
  try {
    persistLabScenarioId(snap.scenarioId);
    sessionStorage.setItem(LAB_SESSION_STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

export function readLabSessionSnapshot(): LabSessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(LAB_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LabSessionSnapshot;
    if (!parsed || typeof parsed.scenarioId !== 'string') return null;
    return {
      ...parsed,
      mutations: parsed.mutations ?? EMPTY_MUTATIONS,
      edgePathPreset: parsed.edgePathPreset ?? 'smoothstep',
      layoutAlgorithm: parsed.layoutAlgorithm ?? 'layered',
      consoleVisible: parsed.consoleVisible ?? false,
      highlightedNodeIds: parsed.highlightedNodeIds ?? [],
      useNotebookSources: parsed.useNotebookSources ?? false,
      allowWeb: parsed.allowWeb ?? true,
      selectedSourceIds: Array.isArray(parsed.selectedSourceIds) ? parsed.selectedSourceIds : [],
      // never auto-resume playback on restore
      playing: false,
    };
  } catch {
    return null;
  }
}

export function clearLabSessionSnapshot(): void {
  try {
    sessionStorage.removeItem(LAB_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
