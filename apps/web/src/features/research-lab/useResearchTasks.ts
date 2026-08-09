import type { ResearchRunStatus } from '@crystalith/shared';
import { useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';

import { listResearchRuns, summaryToTaskItem } from './edenResearchApi';
import {
  clearResearchTasksCache,
  refreshResearchTasks,
  researchTasksSwrKey,
} from './researchTasksCache';
import { isActiveResearchStatus, type ResearchTaskListItem } from './researchTaskTypes';

const ACTIVE_STATUSES: ResearchRunStatus[] = ['queued', 'running', 'awaiting_confirm'];

/** Product task list — Eden ResearchRun only (demo injects tasks into the drawer). */
export function useResearchTasks(notebookId: number | null): {
  tasks: ResearchTaskListItem[];
  activeCount: number;
  activeTaskId: string | null;
  loading: boolean;
  error: string;
  refresh: () => void;
} {
  const prevNotebookIdRef = useRef<number | null>(null);

  const key = notebookId && notebookId > 0 ? researchTasksSwrKey(notebookId) : null;

  const { data, error, isLoading, mutate } = useSWR<ResearchTaskListItem[], Error>(
    key,
    async ([, nid]: readonly ['research-tasks', number]): Promise<ResearchTaskListItem[]> => {
      const page = await listResearchRuns(nid, { offset: 0, limit: 50 });
      return page.items.map(summaryToTaskItem);
    },
    { revalidateOnFocus: true },
  );

  useEffect(() => {
    const prev = prevNotebookIdRef.current;
    if (prev !== null && prev > 0 && prev !== notebookId) {
      clearResearchTasksCache(prev);
    }
    prevNotebookIdRef.current = notebookId && notebookId > 0 ? notebookId : null;
  }, [notebookId]);

  const tasks = data ?? [];

  const activeCount = useMemo(
    () => tasks.filter((t) => isActiveResearchStatus(t.status)).length,
    [tasks],
  );

  const refresh = useMemo(
    () => () => {
      if (notebookId && notebookId > 0) refreshResearchTasks(notebookId);
      else void mutate();
    },
    [mutate, notebookId],
  );

  return {
    tasks,
    activeCount,
    activeTaskId: null,
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : '',
    refresh,
  };
}

export { ACTIVE_STATUSES, refreshResearchTasks, clearResearchTasksCache, researchTasksSwrKey };
