import { Position, type Edge, type Node } from '@xyflow/react';
import type { ElkNode } from 'elkjs/lib/elk.bundled.js';
import ELK from 'elkjs/lib/elk.bundled.js';

import type {
  LabEdge,
  LabEdgePathPreset,
  LabLayoutAlgorithm,
  LabLayoutDirection,
  LabNode,
  LabNodeRole,
} from './types';

const elk = new ELK();

export type LabRfData = {
  title: string;
  conclusionStatus: LabNode['conclusionStatus'];
  phase?: string;
  role?: LabNodeRole;
  preview?: string;
  selected?: boolean;
  direction: LabLayoutDirection;
  progressPct: number;
  statusHint?: string;
  showProgress: boolean;
  animDelayMs: number;
  reshaping?: boolean;
  /** Question-node: pause at awaiting_confirm when true. */
  askOnInterrupt?: boolean;
  /** Conclusion footer when some merges are pruned failures. */
  statusOverride?: string;
  /** Soft ring from citation multi-match (in addition to selected). */
  highlighted?: boolean;
};

export type LabEdgeData = {
  labelNote?: string;
  kind: string;
  canPrune: boolean;
  canFork: boolean;
  /** Edge touches a pruned branch — mute stroke/label; keep「汇入」wording. */
  faded?: boolean;
  onFork: (edgeId: string) => void;
  onPrune: (edgeId: string) => void;
  pathOffset: number;
  pathPreset: LabEdgePathPreset;
};

/** Node card progress / status hint (exported for live LabGraph patches). */
export function nodeProgress(n: LabNode): { pct: number; hint?: string; show: boolean } {
  if (n.role === 'question') return { pct: 0, show: false };
  if (n.conclusionStatus === 'pruned') return { pct: 0, hint: '已剪枝', show: false };
  if (n.conclusionStatus === 'clear') return { pct: 100, hint: '明确', show: false };
  if (n.conclusionStatus === 'partial') return { pct: 100, hint: '待完善', show: false };
  if (n.conclusionStatus === 'missing') return { pct: 100, hint: '无法结论', show: false };
  if (n.phase === 'retrieving') return { pct: 42, hint: '检索中…', show: true };
  if (n.phase === 'synthesizing') return { pct: 78, hint: '综合中…', show: true };
  if (n.conclusionStatus === 'pending') return { pct: 18, hint: '排队…', show: true };
  return { pct: 0, show: false };
}

function estimateSize(n: LabNode): { width: number; height: number } {
  if (n.role === 'question' || n.role === 'conclusion') {
    return { width: 260, height: 118 };
  }
  return { width: 188, height: 78 };
}

function elkLayoutOptions(
  direction: LabLayoutDirection,
  algorithm: LabLayoutAlgorithm,
): Record<string, string> {
  const dir = direction === 'TB' ? 'DOWN' : 'RIGHT';
  const base = {
    'elk.direction': dir,
    'elk.spacing.nodeNode': '56',
    'elk.spacing.edgeNode': '28',
    'elk.spacing.edgeEdge': '24',
    'elk.padding': '[24,24,24,24]',
  };

  if (algorithm === 'mrtree') {
    return {
      ...base,
      'elk.algorithm': 'mrtree',
      'elk.mrtree.searchOrder': 'DFS',
      'elk.edgeRouting': 'ORTHOGONAL',
    };
  }

  if (algorithm === 'force') {
    return {
      ...base,
      'elk.algorithm': 'force',
      'elk.force.iterations': '300',
      'elk.force.repulsivePower': '0',
      'elk.edgeRouting': 'POLYLINE',
    };
  }

  return {
    ...base,
    'elk.algorithm': 'layered',
    'elk.layered.spacing.nodeNodeBetweenLayers': direction === 'TB' ? '90' : '110',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.edgeRouting': 'ORTHOGONAL',
  };
}

export async function layoutWithElk(
  nodes: LabNode[],
  edges: LabEdge[],
  direction: LabLayoutDirection,
  handlers: { onFork: (id: string) => void; onPrune: (id: string) => void },
  opts?: { reshaping?: boolean; algorithm?: LabLayoutAlgorithm },
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const algorithm = opts?.algorithm ?? 'layered';
  const sizeById = new Map(nodes.map((n) => [n.id, estimateSize(n)]));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: elkLayoutOptions(direction, algorithm),
    children: nodes.map((n) => {
      const size = sizeById.get(n.id)!;
      return { id: n.id, width: size.width, height: size.height };
    }),
    edges: edges
      .filter((e) => sizeById.has(e.source) && sizeById.has(e.target))
      .map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
  };

  const laid = await elk.layout(graph);
  const pos = new Map<string, { x: number; y: number; layer: number }>();
  for (const child of laid.children ?? []) {
    pos.set(child.id, {
      x: child.x ?? 0,
      y: child.y ?? 0,
      layer: 0,
    });
  }

  // Approximate layer from primary axis for stagger animation.
  const axisVals = [...pos.values()].map((p) => (direction === 'TB' ? p.y : p.x));
  const minA = Math.min(...axisVals, 0);
  const step = direction === 'TB' ? 90 : 110;
  for (const [id, p] of pos) {
    const a = direction === 'TB' ? p.y : p.x;
    pos.set(id, { ...p, layer: Math.max(0, Math.round((a - minA) / step)) });
  }

  const conclusionId =
    nodes.find((n) => n.role === 'conclusion')?.id ??
    (nodes.some((n) => n.id === 'conclusion') ? 'conclusion' : null);
  const failedMerge =
    conclusionId !== null &&
    edges.some((e) => {
      if (e.target !== conclusionId && nodeById.get(e.target)?.role !== 'conclusion') return false;
      if (e.kind !== 'merge' && e.target !== conclusionId) return false;
      return nodeById.get(e.source)?.conclusionStatus === 'pruned';
    });

  const rfNodes: Node[] = nodes.map((n) => {
    const p = pos.get(n.id) ?? { x: 0, y: 0, layer: 0 };
    const prog = nodeProgress(n);
    const isConclusion = n.role === 'conclusion' || n.id === conclusionId;
    return {
      id: n.id,
      type: 'lab',
      position: { x: p.x, y: p.y },
      sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
      targetPosition: direction === 'TB' ? Position.Top : Position.Left,
      data: {
        title: n.title,
        conclusionStatus: n.conclusionStatus,
        phase: n.phase,
        role: n.role,
        preview:
          n.role === 'question' || n.role === 'conclusion' ? n.conclusion || n.summary : undefined,
        direction,
        progressPct: prog.pct,
        statusHint: prog.hint,
        showProgress: prog.show,
        animDelayMs: opts?.reshaping ? 0 : Math.min(p.layer * 70, 420),
        reshaping: Boolean(opts?.reshaping && n.role === 'conclusion'),
        askOnInterrupt: n.askOnInterrupt,
        statusOverride:
          isConclusion && failedMerge
            ? '部分汇入失败'
            : isConclusion
              ? n.statusOverride
              : undefined,
      } satisfies LabRfData,
    };
  });

  const inEdges = new Map<string, LabEdge[]>();
  for (const e of edges) {
    const inns = inEdges.get(e.target) ?? [];
    inns.push(e);
    inEdges.set(e.target, inns);
  }
  for (const [, list] of inEdges) {
    list.sort((a, b) => {
      const pa = pos.get(a.source)?.[direction === 'TB' ? 'x' : 'y'] ?? 0;
      const pb = pos.get(b.source)?.[direction === 'TB' ? 'x' : 'y'] ?? 0;
      return pa - pb;
    });
  }

  const rfEdges: Edge[] = edges.map((e) => {
    const source = nodeById.get(e.source);
    const target = nodeById.get(e.target);
    const faded = source?.conclusionStatus === 'pruned' || target?.conclusionStatus === 'pruned';
    const canPrune = target?.role === 'research' && target.conclusionStatus !== 'pruned';
    const canFork = target?.role === 'research' && target.conclusionStatus !== 'pruned';
    const inns = inEdges.get(e.target) ?? [e];
    const inIdx = inns.findIndex((x) => x.id === e.id);
    const inCount = inns.length;
    const pathOffset = inCount <= 1 ? 32 : 24 + (inIdx - (inCount - 1) / 2) * 36;

    const liveStroke = e.kind === 'fork' ? '#0f766e' : e.kind === 'merge' ? '#c2410c' : '#94a3b8';

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'labAction',
      style: {
        stroke: faded ? '#cbd5e1' : liveStroke,
        strokeWidth: faded ? 1.25 : e.kind === 'fork' || e.kind === 'merge' ? 2 : 1.5,
        strokeDasharray: e.kind === 'fork' ? '4 3' : undefined,
        opacity: faded ? 0.55 : 1,
      },
      data: {
        labelNote: e.labelNote,
        kind: e.kind,
        canPrune,
        canFork,
        faded,
        onFork: handlers.onFork,
        onPrune: handlers.onPrune,
        pathOffset,
        pathPreset: 'smoothstep',
      } satisfies LabEdgeData,
    };
  });

  return { nodes: rfNodes, edges: rfEdges };
}
