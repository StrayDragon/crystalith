import type { ResearchRunStatus } from '@crystalith/shared';
import { useMemo } from 'react';
import useSWR from 'swr';

import { listResearchRuns, summaryToTaskItem } from './edenResearchApi';
import { isLabFixtureMode } from './labFixtureMode';
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

  const key =
    !fixture && notebookId && notebookId > 0 ? (['research-tasks', notebookId] as const) : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async ([, nid]) => {
      const page = await listResearchRuns(nid, { offset: 0, limit: 50 });
      return page.items.map(summaryToTaskItem);
    },
    { revalidateOnFocus: true },
  );

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

  return {
    tasks,
    activeCount: fixture ? demo.activeCount : activeCount,
    activeTaskId: fixture ? demo.activeTaskId : null,
    loading: fixture ? false : isLoading,
    error: fixture ? '' : error ? String(error.message ?? error) : '',
    refresh: () => {
      void mutate();
    },
  };
}

export { ACTIVE_STATUSES };
