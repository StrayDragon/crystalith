import type { ResearchEdge, ResearchGraphPatch, ResearchNode } from '@crystalith/shared';

export interface ResearchGraph {
  nodes: ResearchNode[];
  edges: ResearchEdge[];
}

/** Apply D1 graph_patch (upsert by id + removes). Pure; does not mutate inputs. */
export function applyGraphPatch(graph: ResearchGraph, patch: ResearchGraphPatch): ResearchGraph {
  const removeNodes = new Set(patch.removeNodeIds ?? []);
  const removeEdges = new Set(patch.removeEdgeIds ?? []);

  const nodeById = new Map<string, ResearchNode>();
  for (const n of graph.nodes) {
    if (!removeNodes.has(n.id)) nodeById.set(n.id, n);
  }
  for (const n of patch.nodes ?? []) {
    if (removeNodes.has(n.id)) continue;
    nodeById.set(n.id, { ...nodeById.get(n.id), ...n });
  }

  const edgeById = new Map<string, ResearchEdge>();
  for (const e of graph.edges) {
    if (!removeEdges.has(e.id)) edgeById.set(e.id, e);
  }
  for (const e of patch.edges ?? []) {
    if (removeEdges.has(e.id)) continue;
    edgeById.set(e.id, { ...edgeById.get(e.id), ...e });
  }

  return {
    nodes: [...nodeById.values()],
    edges: [...edgeById.values()],
  };
}
