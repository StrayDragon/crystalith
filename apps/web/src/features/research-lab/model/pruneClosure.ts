import type { LabEdge, LabNode } from './types';

/** Collect node + all descendants via outgoing edges. */
export function collectDescendants(rootId: string, edges: LabEdge[]): Set<string> {
  const children = new Map<string, string[]>();
  for (const e of edges) {
    const list = children.get(e.source) ?? [];
    list.push(e.target);
    children.set(e.source, list);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const c of children.get(id) ?? []) stack.push(c);
  }
  return out;
}

function isPruneProtected(node: LabNode | undefined, id: string): boolean {
  if (!node) return id === 'root' || id === 'conclusion';
  return (
    node.role === 'question' || node.role === 'conclusion' || id === 'root' || id === 'conclusion'
  );
}

function isCascadeEdge(edge: LabEdge): boolean {
  // Merges stay as failed contributions — never cascade prune into the sink.
  return edge.kind !== 'merge';
}

/**
 * Prune closure (product B) — MOCK twin of server `collectResearchPruneClosure`.
 * Keep algorithms in sync when changing r316 / update-research-prune-cascade.
 *
 * - Never includes question / conclusion
 * - Does not walk merge edges
 * - Cascades to a child only when every non-protected inbound parent is already
 *   in the closure or already pruned (shared nodes with a live parent stay live)
 */
export function collectPruneClosure(
  rootId: string,
  nodes: LabNode[],
  edges: LabEdge[],
): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const root = byId.get(rootId);
  if (!root || isPruneProtected(root, rootId)) return new Set();

  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  for (const e of edges) {
    if (!isCascadeEdge(e)) continue;
    const outs = children.get(e.source) ?? [];
    outs.push(e.target);
    children.set(e.source, outs);
    const inns = parents.get(e.target) ?? [];
    inns.push(e.source);
    parents.set(e.target, inns);
  }

  const out = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const childId of children.get(id) ?? []) {
      if (out.has(childId)) continue;
      if (isPruneProtected(byId.get(childId), childId)) continue;
      const blocking = (parents.get(childId) ?? []).some((pid) => {
        if (out.has(pid)) return false;
        const p = byId.get(pid);
        if (isPruneProtected(p, pid)) return false;
        if (p?.conclusionStatus === 'pruned') return false;
        return true;
      });
      if (blocking) continue;
      out.add(childId);
      stack.push(childId);
    }
  }
  return out;
}
