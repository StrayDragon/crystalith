import { useMemo, useSyncExternalStore } from 'react';

import {
  EMPTY_DEMO_RESEARCH_TASKS,
  getActiveDemoResearchTaskId,
  getDemoResearchTasksSnapshot,
  subscribeDemoResearchTasks,
  type DemoResearchTask,
} from './demoResearchTasks';

function subscribe(cb: () => void): () => void {
  return subscribeDemoResearchTasks(cb);
}

function getServerTasksSnapshot(): DemoResearchTask[] {
  return EMPTY_DEMO_RESEARCH_TASKS;
}

function getServerActiveId(): string | null {
  return null;
}

export function useDemoResearchTasks(notebookId?: number | null): {
  tasks: DemoResearchTask[];
  activeCount: number;
  activeTaskId: string | null;
} {
  const all = useSyncExternalStore(subscribe, getDemoResearchTasksSnapshot, getServerTasksSnapshot);
  const activeTaskId = useSyncExternalStore(
    subscribe,
    getActiveDemoResearchTaskId,
    getServerActiveId,
  );

  const tasks = useMemo(() => {
    const filtered =
      notebookId === null || notebookId === undefined || notebookId <= 0
        ? all
        : all.filter((t) => t.notebookId === notebookId);
    return filtered.toSorted((a, b) => b.updatedAt - a.updatedAt);
  }, [all, notebookId]);

  const activeCount = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === 'queued' || t.status === 'running' || t.status === 'awaiting_confirm',
      ).length,
    [tasks],
  );

  return { tasks, activeCount, activeTaskId };
}
