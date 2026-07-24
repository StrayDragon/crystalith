/**
 * Shared SWR key + cache helpers for Lab / workspace research task inbox.
 */
import { mutate } from 'swr';

export function researchTasksSwrKey(notebookId: number) {
  return ['research-tasks', notebookId] as const;
}

/** Revalidate task list for a notebook (create / SSE / command success). */
export function refreshResearchTasks(notebookId: number): void {
  if (!(notebookId > 0)) return;
  void mutate(researchTasksSwrKey(notebookId));
}

/** Drop cached list when leaving a notebook (no revalidate). */
export function clearResearchTasksCache(notebookId: number): void {
  if (!(notebookId > 0)) return;
  void mutate(researchTasksSwrKey(notebookId), undefined, { revalidate: false });
}
