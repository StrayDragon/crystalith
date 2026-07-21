import type { SlideStage } from '../../../shared/types';

export const STAGES: { id: SlideStage; label: string }[] = [
  { id: 'input', label: '输入' },
  { id: 'outline', label: '大纲' },
  { id: 'markdown', label: 'Markdown' },
];

export type SlideQueueStatus = 'queued' | 'running' | 'error' | 'done' | 'cancelled';

export const QUEUE_STATUS_LABELS = {
  queued: '排队中',
  running: '生成中',
  error: '失败',
  done: '已完成',
  cancelled: '已取消',
} as const satisfies Record<SlideQueueStatus, string>;
