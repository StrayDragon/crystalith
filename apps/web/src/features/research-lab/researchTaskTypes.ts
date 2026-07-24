/**
 * Unified research task list item for drawer (fixture demo id string or Eden run id).
 */
import type { ResearchRunStatus } from '@crystalith/shared';

export type ResearchTaskStatus =
  | ResearchRunStatus
  | 'queued'
  | 'running'
  | 'awaiting_confirm'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ResearchTaskListItem {
  id: string;
  notebookId: number;
  topic: string;
  status: ResearchTaskStatus;
}

export const RESEARCH_TASK_STATUS_LABEL: Record<string, string> = {
  queued: '排队中',
  running: '进行中',
  awaiting_confirm: '待确认',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

export function isActiveResearchStatus(status: string): boolean {
  return status === 'queued' || status === 'running' || status === 'awaiting_confirm';
}
