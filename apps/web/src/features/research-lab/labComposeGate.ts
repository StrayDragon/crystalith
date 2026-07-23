/** Compose gate for Lab empty-state create (mirrors ResearchCreate server rules). */

export interface LabComposeDraft {
  topic: string;
  useNotebookSources: boolean;
  allowWeb: boolean;
  selectedSourceIds: number[];
}

export type LabComposeBlockReason = 'topic' | 'no_channel' | 'need_sources';

export const LAB_COMPOSE_BLOCK_MESSAGES: Record<LabComposeBlockReason, string> = {
  topic: '请先填写研究主题',
  no_channel: '请至少开启「使用笔记本来源」或「允许外网检索」',
  need_sources: '已开启「使用笔记本来源」：请勾选至少一个就绪来源，或改用外网检索',
};

export function resolveLabComposeBlockReason(draft: LabComposeDraft): LabComposeBlockReason | null {
  if (!draft.topic.trim()) return 'topic';
  if (!draft.useNotebookSources && !draft.allowWeb) return 'no_channel';
  if (draft.useNotebookSources && draft.selectedSourceIds.length === 0) return 'need_sources';
  return null;
}
