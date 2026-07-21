import type { ResearchEdge, ResearchGraphPatch, ResearchNode } from '@crystalith/shared';

export interface ResearchGraphState {
  nodes: ResearchNode[];
  edges: ResearchEdge[];
}

/** Apply D1 graph_patch (upsert nodes/edges; remove by id). */
export function applyGraphPatch(
  state: ResearchGraphState,
  patch: ResearchGraphPatch,
): ResearchGraphState {
  let nodes = [...state.nodes];
  let edges = [...state.edges];

  if (patch.removeNodeIds?.length) {
    const remove = new Set(patch.removeNodeIds);
    nodes = nodes.filter((n) => !remove.has(n.id));
    edges = edges.filter((e) => !remove.has(e.source) && !remove.has(e.target));
  }
  if (patch.removeEdgeIds?.length) {
    const remove = new Set(patch.removeEdgeIds);
    edges = edges.filter((e) => !remove.has(e.id));
  }
  if (patch.nodes?.length) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const n of patch.nodes) byId.set(n.id, n);
    nodes = Array.from(byId.values());
  }
  if (patch.edges?.length) {
    const byId = new Map(edges.map((e) => [e.id, e]));
    for (const e of patch.edges) byId.set(e.id, e);
    edges = Array.from(byId.values());
  }

  return { nodes, edges };
}
