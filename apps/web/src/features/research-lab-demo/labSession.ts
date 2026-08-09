import type { ResearchConclusionStatus } from '@crystalith/shared';

import { isRecord, parseJsonValue } from '../../shared/json';
import type {
  LabEdgePathPreset,
  LabGraphMutations,
  LabLayoutAlgorithm,
  LabLayoutDirection,
  LabMetrics,
  LabNode,
  LabPhase,
} from '../research-lab/model/types';
import {
  LAB_EDGE_PATH_PRESETS,
  LAB_LAYOUT_ALGORITHMS,
  LAB_PHASES,
} from '../research-lab/model/types';
import { EMPTY_MUTATIONS } from './fake/deriveLabState';

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

function parseLabPhase(value: unknown): LabPhase {
  if (typeof value !== 'string') return 'completed';
  return LAB_PHASES.find((phase) => phase === value) ?? 'completed';
}

function parseLayoutDirection(value: unknown): LabLayoutDirection {
  return value === 'LR' ? 'LR' : 'TB';
}

function parseEdgePathPreset(value: unknown): LabEdgePathPreset {
  const match = LAB_EDGE_PATH_PRESETS.find((preset) => preset.id === value);
  return match?.id ?? 'smoothstep';
}

function parseLayoutAlgorithm(value: unknown): LabLayoutAlgorithm {
  const match = LAB_LAYOUT_ALGORITHMS.find((algo) => algo.id === value);
  return match?.id ?? 'layered';
}

function parseForceStatus(value: unknown): ResearchConclusionStatus | null {
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const statuses: ResearchConclusionStatus[] = ['clear', 'partial', 'missing', 'pending', 'pruned'];
  return statuses.find((status) => status === value) ?? null;
}

function parseMutations(value: unknown): LabGraphMutations {
  if (!isRecord(value)) return EMPTY_MUTATIONS;
  // Fixture sessionStorage may carry graph overlay blobs; permissive restore at this boundary.
  /* oxlint-disable typescript/no-unsafe-type-assertion -- demo JSON graph overlays */
  return {
    prunedNodeIds: Array.isArray(value.prunedNodeIds)
      ? value.prunedNodeIds.filter((id): id is string => typeof id === 'string')
      : [],
    extraNodes: Array.isArray(value.extraNodes) ? (value.extraNodes as LabNode[]) : [],
    extraEdges: Array.isArray(value.extraEdges)
      ? (value.extraEdges as LabGraphMutations['extraEdges'])
      : [],
    nodeEdits: isRecord(value.nodeEdits) ? (value.nodeEdits as LabGraphMutations['nodeEdits']) : {},
    activityNotes: Array.isArray(value.activityNotes)
      ? value.activityNotes.filter((note): note is string => typeof note === 'string')
      : [],
  };
  /* oxlint-enable typescript/no-unsafe-type-assertion */
}

function parseMetricsOverride(value: unknown): Partial<LabMetrics> | null {
  if (!isRecord(value)) return null;
  const override: Partial<LabMetrics> = {};
  if (typeof value.tokensUsed === 'number') override.tokensUsed = value.tokensUsed;
  if (typeof value.sourcesRetrieved === 'number')
    override.sourcesRetrieved = value.sourcesRetrieved;
  if (typeof value.pendingNodes === 'number') override.pendingNodes = value.pendingNodes;
  if (typeof value.elapsedSec === 'number') override.elapsedSec = value.elapsedSec;
  return Object.keys(override).length > 0 ? override : null;
}

function parseLabSessionSnapshot(parsed: Record<string, unknown>): LabSessionSnapshot | null {
  if (typeof parsed.scenarioId !== 'string') return null;

  return {
    scenarioId: parsed.scenarioId,
    phase: parseLabPhase(parsed.phase),
    playing: false,
    playbackMs: typeof parsed.playbackMs === 'number' ? parsed.playbackMs : 0,
    layoutDirection: parseLayoutDirection(parsed.layoutDirection),
    edgePathPreset: parseEdgePathPreset(parsed.edgePathPreset),
    layoutAlgorithm: parseLayoutAlgorithm(parsed.layoutAlgorithm),
    selectedNodeId:
      typeof parsed.selectedNodeId === 'string'
        ? parsed.selectedNodeId
        : parsed.selectedNodeId === null
          ? null
          : null,
    highlightedNodeIds: Array.isArray(parsed.highlightedNodeIds)
      ? parsed.highlightedNodeIds.filter((id): id is string => typeof id === 'string')
      : [],
    consoleOpen: typeof parsed.consoleOpen === 'boolean' ? parsed.consoleOpen : false,
    consoleVisible: typeof parsed.consoleVisible === 'boolean' ? parsed.consoleVisible : false,
    forceStatus: parseForceStatus(parsed.forceStatus),
    metricsOverride: parseMetricsOverride(parsed.metricsOverride),
    confirmChoice: typeof parsed.confirmChoice === 'string' ? parsed.confirmChoice : null,
    mutations: parseMutations(parsed.mutations),
    topicDraft: typeof parsed.topicDraft === 'string' ? parsed.topicDraft : '',
    forkSeq: typeof parsed.forkSeq === 'number' ? parsed.forkSeq : 0,
    useNotebookSources:
      typeof parsed.useNotebookSources === 'boolean' ? parsed.useNotebookSources : false,
    allowWeb: typeof parsed.allowWeb === 'boolean' ? parsed.allowWeb : true,
    selectedSourceIds: Array.isArray(parsed.selectedSourceIds)
      ? parsed.selectedSourceIds.filter((id): id is number => typeof id === 'number')
      : [],
  };
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
    const parsed = parseJsonValue(raw);
    return isRecord(parsed) ? parseLabSessionSnapshot(parsed) : null;
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
