import type {
  ResearchEdge,
  ResearchNode,
  ResearchRun,
  ResearchRunStatus,
} from '@crystalith/shared';

import type { LabDerivedState, LabEdge, LabNode, LabPhase } from '../research-lab-demo/fake/types';

function inferRole(node: ResearchNode): LabNode['role'] {
  if (node.role) return node.role;
  if (node.id.startsWith('node_root') || node.id === 'root') return 'question';
  if (node.id.startsWith('node_conclusion')) return 'conclusion';
  return 'research';
}

const TERMINAL: ReadonlySet<ResearchRunStatus> = new Set(['completed', 'failed', 'cancelled']);

/**
 * Map wire node → Lab node; on terminal Run, settle pending/in-flight so cards
 * do not keep 「排队…」 (r435).
 */
export function researchNodeToLabNode(
  node: ResearchNode,
  runStatus?: ResearchRunStatus | null,
): LabNode {
  const role = inferRole(node);
  let conclusionStatus = node.conclusionStatus;
  let phase = node.phase;
  let statusOverride: string | undefined;

  if (runStatus && TERMINAL.has(runStatus)) {
    if (phase === 'retrieving' || phase === 'synthesizing') {
      phase = 'idle';
    }
    if (role === 'conclusion' && conclusionStatus === 'pending') {
      if (runStatus === 'completed') {
        conclusionStatus = 'clear';
        statusOverride = '综述就绪';
      } else {
        conclusionStatus = 'missing';
        statusOverride = runStatus === 'failed' ? '失败' : '已取消';
      }
    } else if (role === 'research' && conclusionStatus === 'pending') {
      const hasEv = (node.evidenceIds?.length ?? 0) > 0;
      conclusionStatus = hasEv ? 'partial' : 'missing';
    } else if (role === 'conclusion' && runStatus === 'completed') {
      statusOverride = '综述就绪';
    } else if (role === 'conclusion' && runStatus === 'failed') {
      statusOverride = '失败';
    } else if (role === 'conclusion' && runStatus === 'cancelled') {
      statusOverride = '已取消';
    }
  }

  return {
    id: node.id,
    title: node.title,
    role,
    query: node.query,
    summary: node.summary,
    conclusion: node.summary,
    conclusionStatus,
    phase,
    citationIds: node.evidenceIds ?? [],
    statusOverride,
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

/** playing MUST be true only for queued|running (r437). */
export function isEdenLabPlaying(status: ResearchRunStatus | null | undefined): boolean {
  return status === 'running' || status === 'queued';
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
  const nodes = run.nodes.map((n) => researchNodeToLabNode(n, run.status));
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
