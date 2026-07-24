import type {
  ResearchEdge,
  ResearchNode,
  ResearchRun,
  ResearchRunStatus,
} from '@crystalith/shared';

import type { LabDerivedState, LabEdge, LabNode, LabPhase } from './fake/types';

function inferRole(node: ResearchNode): LabNode['role'] {
  if (node.role) return node.role;
  if (node.id.startsWith('node_root') || node.id === 'root') return 'question';
  if (node.id.startsWith('node_conclusion')) return 'conclusion';
  return 'research';
}

export function researchNodeToLabNode(node: ResearchNode): LabNode {
  return {
    id: node.id,
    title: node.title,
    role: inferRole(node),
    query: node.query,
    summary: node.summary,
    conclusion: node.summary,
    conclusionStatus: node.conclusionStatus,
    phase: node.phase,
    citationIds: node.evidenceIds ?? [],
  };
}

export function researchEdgeToLabEdge(edge: ResearchEdge): LabEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    kind: edge.kind,
    labelNote: edge.labelNote,
  };
}

export function researchRunStatusToLabPhase(status: ResearchRunStatus | null): LabPhase {
  switch (status) {
    case null:
      return 'idle';
    case 'queued':
      return 'decompose';
    case 'running':
      return 'explore';
    case 'awaiting_confirm':
      return 'awaiting_confirm';
    case 'completed':
      return 'completed';
    case 'failed':
    case 'cancelled':
      return 'failed';
    default:
      return 'idle';
  }
}

export function deriveLabStateFromRun(
  run: ResearchRun | null,
  activityLog: string[] = [],
): LabDerivedState {
  if (!run) {
    return {
      nodes: [],
      edges: [],
      metrics: { tokensUsed: 0, sourcesRetrieved: 0, pendingNodes: 0, elapsedSec: 0 },
      activityLog,
      reportVisible: false,
      rootTitle: '',
      conclusionNodeId: null,
    };
  }
  const nodes = run.nodes.map(researchNodeToLabNode);
  const edges = run.edges.map(researchEdgeToLabEdge);
  const conclusion =
    nodes.find((n) => n.role === 'conclusion') ??
    nodes.find((n) => n.id.startsWith('node_conclusion'));
  const question =
    nodes.find((n) => n.role === 'question') ?? nodes.find((n) => n.id.startsWith('node_root'));
  const pendingNodes = nodes.filter(
    (n) =>
      n.role === 'research' && n.conclusionStatus !== 'pruned' && n.conclusionStatus !== 'clear',
  ).length;
  return {
    nodes,
    edges,
    metrics: {
      tokensUsed: 0,
      sourcesRetrieved: run.searchesUsed,
      pendingNodes,
      elapsedSec: 0,
    },
    activityLog,
    reportVisible: run.status === 'completed' && Boolean(run.report),
    rootTitle: question?.title ?? run.topic,
    conclusionNodeId: conclusion?.id ?? null,
  };
}
