/**
 * Serial research-node work queue (c94 / r327).
 * Stable order = graph.nodes insertion order (decompose/fork append order).
 */
import type { ResearchNode } from '@crystalith/shared';

export function resolveNodeRoleForWork(
  n: Pick<ResearchNode, 'id' | 'role'>,
): 'question' | 'research' | 'conclusion' {
  if (n.role === 'question' || n.role === 'research' || n.role === 'conclusion') return n.role;
  if (n.id.startsWith('node_root')) return 'question';
  if (n.id.startsWith('node_conclusion')) return 'conclusion';
  return 'research';
}

/** True when a research node still needs a first (or in-flight) work-unit. */
export function researchNodeNeedsWork(n: ResearchNode): boolean {
  if (resolveNodeRoleForWork(n) !== 'research') return false;
  if (n.conclusionStatus === 'pruned') return false;
  if (n.phase === 'retrieving') return true;
  if ((n.evidenceIds?.length ?? 0) > 0) return false;
  // After budget-skip / empty writeBack we set conclusionStatus=missing — do not re-queue.
  if (n.conclusionStatus === 'missing' || n.conclusionStatus === 'clear') return false;
  return true;
}

/**
 * Stable work queue: preserve `nodes` array insertion order (F2=B).
 * Does not sort by id/title — filter only.
 */
export function orderResearchNodesForWork(nodes: readonly ResearchNode[]): ResearchNode[] {
  return nodes.filter(researchNodeNeedsWork);
}

/** Live research children present (used to skip question work-unit — F1=A). */
export function hasLiveResearchBranches(nodes: readonly ResearchNode[]): boolean {
  return nodes.some(
    (n) => resolveNodeRoleForWork(n) === 'research' && n.conclusionStatus !== 'pruned',
  );
}
