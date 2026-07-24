import type { ResearchDepth } from '@crystalith/shared';
import { RESEARCH_DEPTH_BUDGETS } from '@crystalith/shared';

export const DEFAULT_LAB_COMPOSE_DEPTH: ResearchDepth = 'medium';

export const LAB_COMPOSE_DEPTH_OPTIONS: ReadonlyArray<{
  value: ResearchDepth;
  label: string;
}> = [
  { value: 'shallow', label: '浅' },
  { value: 'medium', label: '中' },
  { value: 'deep', label: '深' },
];

/** One-line budget hint aligned with r305 / RESEARCH_DEPTH_BUDGETS. */
export function labComposeDepthBudgetHint(depth: ResearchDepth): string {
  const b = RESEARCH_DEPTH_BUDGETS[depth];
  return `${LAB_COMPOSE_DEPTH_OPTIONS.find((o) => o.value === depth)?.label ?? depth}：约 ${b.maxSearches} 次检索 / ${b.maxNodes} 节点`;
}
