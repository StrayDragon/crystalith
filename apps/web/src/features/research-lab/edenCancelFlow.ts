/**
 * Shared Eden cancel command: POST cancel then refresh task inbox (r425 / r426).
 */
import type { ResearchRun } from '@crystalith/shared';

import { cancelResearchRun } from './edenResearchApi';
import { refreshResearchTasks } from './researchTasksCache';

export async function cancelActiveEdenRun(notebookId: number, runId: number): Promise<ResearchRun> {
  const next = await cancelResearchRun(notebookId, runId);
  refreshResearchTasks(notebookId);
  return next;
}
