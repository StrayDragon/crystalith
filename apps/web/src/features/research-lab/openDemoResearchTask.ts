/**
 * Switch demo research task: park current Lab session, restore target, set active.
 */
import {
  getActiveDemoResearchTaskId,
  persistTaskLabSessionRaw,
  readTaskLabSessionRaw,
  setActiveDemoResearchTaskId,
  bumpDemoTaskSwitchEpoch,
  type DemoResearchTask,
} from './demoResearchTasks';
import { navigateToResearchLab } from './labRouting';
import {
  persistLabSessionSnapshot,
  readLabSessionSnapshot,
  type LabSessionSnapshot,
} from './labSession';

const MAIN_SESSION_KEY = 'crystalith.research-lab.session';

function parkCurrentSessionIfAny(): void {
  const activeId = getActiveDemoResearchTaskId();
  if (!activeId) return;
  try {
    const raw = sessionStorage.getItem(MAIN_SESSION_KEY);
    if (raw) persistTaskLabSessionRaw(activeId, raw);
  } catch {
    /* ignore */
  }
}

function restoreTaskSession(task: DemoResearchTask): void {
  const raw = readTaskLabSessionRaw(task.id);
  if (raw) {
    try {
      sessionStorage.setItem(MAIN_SESSION_KEY, raw);
      return;
    } catch {
      /* fall through */
    }
  }
  // No parked session — seed idle compose with this task's topic.
  const seed: LabSessionSnapshot = {
    scenarioId: task.scenarioId || 'xlsx-lib',
    phase: task.status === 'completed' ? 'completed' : task.status === 'failed' ? 'failed' : 'idle',
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
    mutations: {
      prunedNodeIds: [],
      extraNodes: [],
      extraEdges: [],
      nodeEdits: {},
      activityNotes: [],
    },
    topicDraft: task.topic,
    forkSeq: 0,
    useNotebookSources: false,
    allowWeb: true,
    selectedSourceIds: [],
  };
  // If task was in progress but we lost graph, at least open compose/completed with topic.
  if (task.status === 'running' || task.status === 'awaiting_confirm' || task.status === 'queued') {
    seed.phase = 'idle';
    seed.topicDraft = task.topic;
  }
  persistLabSessionSnapshot(seed);
}

/** Open / switch to a demo research task in Lab. */
export function openDemoResearchTask(task: DemoResearchTask): void {
  parkCurrentSessionIfAny();
  setActiveDemoResearchTaskId(task.id);
  restoreTaskSession(task);
  bumpDemoTaskSwitchEpoch();
  navigateToResearchLab(task.notebookId);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Open Lab compose for a new demo task (does not create a run until submit). */
export function openNewDemoResearchCompose(notebookId: number): void {
  parkCurrentSessionIfAny();
  setActiveDemoResearchTaskId(null);
  persistLabSessionSnapshot({
    scenarioId: 'xlsx-lib',
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
    mutations: {
      prunedNodeIds: [],
      extraNodes: [],
      extraEdges: [],
      nodeEdits: {},
      activityNotes: [],
    },
    topicDraft: '',
    forkSeq: 0,
    useNotebookSources: false,
    allowWeb: true,
    selectedSourceIds: [],
  });
  bumpDemoTaskSwitchEpoch();
  navigateToResearchLab(notebookId);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** After compose creates a run — park current main session under the new task id. */
export function bindActiveTaskSession(): void {
  const activeId = getActiveDemoResearchTaskId();
  const snap = readLabSessionSnapshot();
  if (!activeId || !snap) return;
  try {
    persistTaskLabSessionRaw(activeId, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}
