import type { LabNode, LabNodeRole } from './types';

const ROLE_RANK: Record<LabNodeRole, number> = {
  research: 0,
  conclusion: 1,
  question: 2,
};

/** Nodes that list this citation (document order by role preference). */
export function findNodesByCitation(nodes: LabNode[], citationId: string): LabNode[] {
  return nodes
    .filter((n) => n.citationIds.includes(citationId))
    .toSorted((a, b) => {
      const ra = ROLE_RANK[a.role ?? 'research'] ?? 9;
      const rb = ROLE_RANK[b.role ?? 'research'] ?? 9;
      if (ra !== rb) return ra - rb;
      return a.id.localeCompare(b.id);
    });
}

export function pickPreferredCiteNode(nodes: LabNode[]): LabNode | null {
  return nodes[0] ?? null;
}
