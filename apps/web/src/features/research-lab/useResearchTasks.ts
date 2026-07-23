import type { ResearchRunStatus } from '@crystalith/shared';
import { useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';

import { listResearchRuns, summaryToTaskItem } from './edenResearchApi';
import { isLabFixtureMode } from './labFixtureMode';
import {
  clearResearchTasksCache,
  refreshResearchTasks,
  researchTasksSwrKey,
} from './researchTasksCache';
import { isActiveResearchStatus, type ResearchTaskListItem } from './researchTaskTypes';
import { useDemoResearchTasks } from './useDemoResearchTasks';

const ACTIVE_STATUSES: ResearchRunStatus[] = ['queued', 'running', 'awaiting_confirm'];

export function useResearchTasks(notebookId: number | null): {
  tasks: ResearchTaskListItem[];
  activeCount: number;
  activeTaskId: string | null;
  loading: boolean;
  error: string;
  refresh: () => void;
} {
  const fixture = isLabFixtureMode();
  const demo = useDemoResearchTasks(notebookId);
  const prevNotebookIdRef = useRef<number | null>(null);

  const key = !fixture && notebookId && notebookId > 0 ? researchTasksSwrKey(notebookId) : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async ([, nid]: readonly ['research-tasks', number]) => {
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

  const tasks = useMemo(() => {
    if (fixture) {
      return demo.tasks.map((t) => ({
        id: t.id,
        notebookId: t.notebookId,
        topic: t.topic,
        status: t.status,
      }));
    }
    return data ?? [];
  }, [fixture, demo.tasks, data]);

  const activeCount = useMemo(
    () => tasks.filter((t) => isActiveResearchStatus(t.status)).length,
    [tasks],
  );

  const refresh = useMemo(
    () => () => {
      if (fixture) return;
      if (notebookId && notebookId > 0) refreshResearchTasks(notebookId);
      else void mutate();
    },
    [fixture, mutate, notebookId],
  );

  return {
    tasks,
    activeCount: fixture ? demo.activeCount : activeCount,
    activeTaskId: fixture ? demo.activeTaskId : null,
    loading: fixture ? false : isLoading,
    error: fixture ? '' : error ? String(error.message ?? error) : '',
    refresh,
  };
}

export { ACTIVE_STATUSES, refreshResearchTasks, clearResearchTasksCache, researchTasksSwrKey };
