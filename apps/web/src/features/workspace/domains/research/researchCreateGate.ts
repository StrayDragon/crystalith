import type { ResearchDepth } from '@crystalith/shared';

export interface ResearchCreateFormState {
  topic: string;
  useNotebookSources: boolean;
  allowWeb: boolean;
  sourceIds: number[];
  depth: ResearchDepth;
}

export const DEFAULT_RESEARCH_CREATE_FORM: ResearchCreateFormState = {
  topic: '',
  useNotebookSources: true,
  allowWeb: true,
  sourceIds: [],
  depth: 'medium',
};

/** H1′ start gating (c77 r401). */
export function canStartResearch(form: ResearchCreateFormState): boolean {
  return researchStartBlockedReason(form) === null;
}

/**
 * Why Start is disabled — for inline UX copy (null = can start).
 * Keys map to `research.desk.blocked.*` i18n messages.
 */
export type ResearchStartBlockReason = 'topic' | 'no_channel' | 'need_sources' | null;

export function researchStartBlockedReason(
  form: ResearchCreateFormState,
): ResearchStartBlockReason {
  if (!form.topic.trim()) return 'topic';
  if (!form.useNotebookSources && !form.allowWeb) return 'no_channel';
  if (form.useNotebookSources && form.sourceIds.length === 0) return 'need_sources';
  return null;
}

export function isTerminalResearchStatus(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

export function isProcessResearchStatus(status: string): boolean {
  return status === 'queued' || status === 'running' || status === 'awaiting_confirm';
}
