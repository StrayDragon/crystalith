import { parseJsonValue } from '../../shared/json';

/**
 * Demo ResearchRun task list (sessionStorage).
 * Swap for Eden GET …/research list in c82.
 */

export type DemoResearchTaskStatus =
  | 'queued'
  | 'running'
  | 'awaiting_confirm'
  | 'completed'
  | 'failed';

export interface DemoResearchTask {
  id: string;
  notebookId: number;
  topic: string;
  status: DemoResearchTaskStatus;
  createdAt: number;
  updatedAt: number;
  scenarioId: string;
}

const TASKS_KEY = 'crystalith.demo-research-tasks';
const ACTIVE_KEY = 'crystalith.demo-research-active-task';
const SESSION_BY_TASK_PREFIX = 'crystalith.research-lab.session.by-task.';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Bumped when switching / opening compose so Lab remounts from parked session. */
let switchEpoch = 0;

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeDemoResearchTasks(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDemoTaskSwitchEpoch(): number {
  return switchEpoch;
}

export function bumpDemoTaskSwitchEpoch(): void {
  switchEpoch += 1;
  emit();
}

/** Stable empty snapshot for useSyncExternalStore (never allocate a new [] per call). */
export const EMPTY_DEMO_RESEARCH_TASKS: DemoResearchTask[] = [];

let cachedTasksRaw: string | null | undefined = undefined;
let cachedTasksSnapshot: DemoResearchTask[] = EMPTY_DEMO_RESEARCH_TASKS;

function writeAll(tasks: DemoResearchTask[]): void {
  try {
    const raw = JSON.stringify(tasks);
    sessionStorage.setItem(TASKS_KEY, raw);
    cachedTasksRaw = raw;
    cachedTasksSnapshot = tasks;
  } catch {
    cachedTasksRaw = undefined;
  }
  emit();
}

export function listDemoResearchTasks(notebookId?: number | null): DemoResearchTask[] {
  const all = getDemoResearchTasksSnapshot();
  const filtered =
    notebookId === null || notebookId === undefined || notebookId <= 0
      ? all
      : all.filter((t) => t.notebookId === notebookId);
  return filtered.toSorted((a, b) => b.updatedAt - a.updatedAt);
}

/** Cached snapshot — referentially stable until storage changes (required by useSyncExternalStore). */
export function getDemoResearchTasksSnapshot(): DemoResearchTask[] {
  try {
    const raw = sessionStorage.getItem(TASKS_KEY);
    if (raw === cachedTasksRaw) return cachedTasksSnapshot;
    cachedTasksRaw = raw;
    if (!raw) {
      cachedTasksSnapshot = EMPTY_DEMO_RESEARCH_TASKS;
      return cachedTasksSnapshot;
    }
    const parsed = parseJsonValue(raw);
    cachedTasksSnapshot = Array.isArray(parsed)
      ? (parsed as DemoResearchTask[])
      : EMPTY_DEMO_RESEARCH_TASKS;
    return cachedTasksSnapshot;
  } catch {
    cachedTasksRaw = null;
    cachedTasksSnapshot = EMPTY_DEMO_RESEARCH_TASKS;
    return cachedTasksSnapshot;
  }
}

export function countActiveDemoResearchTasks(notebookId?: number | null): number {
  return listDemoResearchTasks(notebookId).filter(
    (t) => t.status === 'queued' || t.status === 'running' || t.status === 'awaiting_confirm',
  ).length;
}

export function getActiveDemoResearchTaskId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveDemoResearchTaskId(taskId: string | null): void {
  try {
    if (taskId) sessionStorage.setItem(ACTIVE_KEY, taskId);
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

export function getDemoResearchTask(taskId: string): DemoResearchTask | null {
  return getDemoResearchTasksSnapshot().find((t) => t.id === taskId) ?? null;
}

let taskSeq = 0;

export function createDemoResearchTask(input: {
  notebookId: number;
  topic: string;
  scenarioId?: string;
  status?: DemoResearchTaskStatus;
}): DemoResearchTask {
  const now = Date.now();
  taskSeq += 1;
  const task: DemoResearchTask = {
    id: `demo-run-${now}-${taskSeq}`,
    notebookId: input.notebookId,
    topic: input.topic.trim() || '未命名研究',
    status: input.status ?? 'running',
    createdAt: now,
    updatedAt: now,
    scenarioId: input.scenarioId ?? 'xlsx-lib',
  };
  writeAll([task, ...getDemoResearchTasksSnapshot().filter((t) => t.id !== task.id)]);
  setActiveDemoResearchTaskId(task.id);
  return task;
}

export function updateDemoResearchTask(
  taskId: string,
  patch: Partial<Pick<DemoResearchTask, 'topic' | 'status' | 'scenarioId'>>,
): DemoResearchTask | null {
  const all = getDemoResearchTasksSnapshot();
  const idx = all.findIndex((t) => t.id === taskId);
  if (idx < 0) return null;
  const next = { ...all[idx], ...patch, updatedAt: Date.now() };
  const copy = [...all];
  copy[idx] = next;
  writeAll(copy);
  return next;
}

export function taskSessionStorageKey(taskId: string): string {
  return `${SESSION_BY_TASK_PREFIX}${taskId}`;
}

export function persistTaskLabSessionRaw(taskId: string, rawJson: string): void {
  try {
    sessionStorage.setItem(taskSessionStorageKey(taskId), rawJson);
  } catch {
    /* ignore */
  }
}

export function readTaskLabSessionRaw(taskId: string): string | null {
  try {
    return sessionStorage.getItem(taskSessionStorageKey(taskId));
  } catch {
    return null;
  }
}

export const DEMO_RESEARCH_STATUS_LABEL: Record<DemoResearchTaskStatus, string> = {
  queued: '排队中',
  running: '进行中',
  awaiting_confirm: '待确认',
  completed: '已完成',
  failed: '失败',
};

/** Map Lab phase → demo task status. */
export function demoStatusFromLabPhase(phase: string): DemoResearchTaskStatus | null {
  if (phase === 'idle') return null;
  if (phase === 'awaiting_confirm') return 'awaiting_confirm';
  if (phase === 'completed') return 'completed';
  if (phase === 'failed') return 'failed';
  if (
    phase === 'decompose' ||
    phase === 'explore' ||
    phase === 'evaluate' ||
    phase === 'integrate'
  ) {
    return 'running';
  }
  return 'running';
}
