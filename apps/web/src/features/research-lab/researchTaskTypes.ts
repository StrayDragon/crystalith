/**
 * Unified research task list item for drawer (fixture demo id string or Eden run id).
 */
import { RESEARCH_ACTIVE_STATUSES, type ResearchRunStatus } from '@crystalith/shared';

export type ResearchTaskStatus = ResearchRunStatus;

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
  return (RESEARCH_ACTIVE_STATUSES as string[]).includes(status);
}

/**
 * r101: Desk 队列在存在非终态 Run 时以短间隔轮询刷新；全终态（或队列为空）
 * 时返回 0 关闭轮询。纯函数以便锁测与 SWR refreshInterval 直接接入。
 */
export const RESEARCH_QUEUE_POLL_MS = 5_000;

export function researchQueuePollInterval(activeCount: number): number {
  return activeCount > 0 ? RESEARCH_QUEUE_POLL_MS : 0;
}
