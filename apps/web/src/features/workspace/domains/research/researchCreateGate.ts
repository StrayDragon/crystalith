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
  if (!form.topic.trim()) return false;
  if (!form.useNotebookSources && !form.allowWeb) return false;
  if (form.useNotebookSources && form.sourceIds.length === 0) return false;
  return true;
}

export function isTerminalResearchStatus(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

export function isProcessResearchStatus(status: string): boolean {
  return status === 'queued' || status === 'running' || status === 'awaiting_confirm';
}
