/**
 * Confirm-branch graph highlight (c96 / H2=B):
 * branch node + direct neighbors along any edge.
 */
export function confirmHighlightIds(
  branchNodeId: string | null | undefined,
  edges: readonly { source: string; target: string }[],
): string[] {
  if (!branchNodeId) return [];
  const ids = new Set<string>([branchNodeId]);
  for (const e of edges) {
    if (e.source === branchNodeId) ids.add(e.target);
    if (e.target === branchNodeId) ids.add(e.source);
  }
  return [...ids];
}
