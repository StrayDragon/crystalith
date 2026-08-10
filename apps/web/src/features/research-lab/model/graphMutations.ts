import { collectPruneClosure } from './pruneClosure';
import type { LabDerivedState, LabEdge, LabNode } from './types';

/**
 * MOCK prune/fork drafts for edge dialogs.
 * Real: preview can be computed client-side the same way; confirm calls Eden
 * `…/nodes/:id/prune` or fork→confirm expand_branch. Do not auto-mutate without confirm.
 */

export interface PrunePreview {
  edgeId: string;
  targetId: string;
  targetTitle: string;
  /** Research nodes that will be faded (exclusive-parent prune closure). */
  fadedNodeIds: string[];
  fadedTitles: string[];
  /** True when this closure has a merge edge into the conclusion. */
  keepsFailedMerge: boolean;
}

/** Preview prune impact without mutating state. */
export function previewPruneAlongEdge(
  edgeId: string,
  derived: LabDerivedState,
): PrunePreview | null {
  const edge = derived.edges.find((e) => e.id === edgeId);
  if (!edge) return null;
  const target = derived.nodes.find((n) => n.id === edge.target);
  if (!target || target.role === 'question' || target.role === 'conclusion') return null;
  if (target.conclusionStatus === 'pruned') return null;

  const fadedNodeIds = [...collectPruneClosure(edge.target, derived.nodes, derived.edges)].filter(
    (id) => {
      const node = derived.nodes.find((n) => n.id === id);
      return Boolean(node) && node!.conclusionStatus !== 'pruned';
    },
  );

  const fadedSet = new Set(fadedNodeIds);
  const conclusionId = derived.conclusionNodeId;
  const keepsFailedMerge = derived.edges.some(
    (e) =>
      fadedSet.has(e.source) &&
      (e.kind === 'merge' ||
        (conclusionId !== null && e.target === conclusionId) ||
        derived.nodes.find((n) => n.id === e.target)?.role === 'conclusion'),
  );

  const byId = new Map(derived.nodes.map((n) => [n.id, n]));
  return {
    edgeId,
    targetId: edge.target,
    targetTitle: target.title,
    fadedNodeIds,
    fadedTitles: fadedNodeIds.map((id) => byId.get(id)?.title ?? id),
    keepsFailedMerge,
  };
}

export interface ForkDraft {
  title: string;
  query: string;
  summary: string;
}

export function defaultForkDraft(
  parent: LabNode | undefined,
  sibling: LabNode | undefined,
): ForkDraft {
  return {
    title: sibling ? `对照：${sibling.title}` : '新研究支路',
    query: sibling?.query ? `${sibling.query} (alt)` : '',
    summary: parent ? `从「${parent.title}」分出的对照研究支路。` : '用户自定义分叉研究支路。',
  };
}

export function findForkContext(
  edgeId: string,
  edges: LabEdge[],
  nodes: LabNode[],
): { edge: LabEdge; parent?: LabNode; sibling?: LabNode } | null {
  const edge = edges.find((e) => e.id === edgeId);
  if (!edge) return null;
  const sibling = nodes.find((n) => n.id === edge.target);
  if (!sibling || sibling.role === 'conclusion' || sibling.role === 'question') return null;
  if (edge.target === 'conclusion' || edge.source === 'conclusion') return null;
  const parent = nodes.find((n) => n.id === edge.source);
  return { edge, parent, sibling };
}
