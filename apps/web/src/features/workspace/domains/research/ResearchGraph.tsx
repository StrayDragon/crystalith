import type { ResearchConclusionStatus, ResearchEdge, ResearchNode } from '@crystalith/shared';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { useEffect, useMemo, useState, type MouseEvent } from 'react';

import { TestIds, tid } from '../../../../shared/testids';

import '@xyflow/react/dist/style.css';

/** r414 — shown on conclusion when pruned research still merges in. */
export const FAILED_MERGE_HINT = '部分汇入失败';

export type ResearchCanvasDirection = 'TB' | 'LR';

export const RESEARCH_CANVAS_PREFS_KEY = 'crystalith.research.canvasPrefs';

export type ResearchCanvasPrefs = {
  direction: ResearchCanvasDirection;
  showMiniMap: boolean;
};

export const DEFAULT_RESEARCH_CANVAS_PREFS: ResearchCanvasPrefs = {
  direction: 'TB',
  showMiniMap: true,
};

/** Pure helper — load canvas prefs from localStorage (C3; no graph API). */
export function loadResearchCanvasPrefs(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): ResearchCanvasPrefs {
  if (!storage) return { ...DEFAULT_RESEARCH_CANVAS_PREFS };
  try {
    const raw = storage.getItem(RESEARCH_CANVAS_PREFS_KEY);
    if (!raw) return { ...DEFAULT_RESEARCH_CANVAS_PREFS };
    const parsed = JSON.parse(raw) as Partial<ResearchCanvasPrefs>;
    return {
      direction: parsed.direction === 'LR' ? 'LR' : 'TB',
      showMiniMap: parsed.showMiniMap !== false,
    };
  } catch {
    return { ...DEFAULT_RESEARCH_CANVAS_PREFS };
  }
}

/** Pure helper — persist canvas prefs (C3; no graph API). */
export function saveResearchCanvasPrefs(
  prefs: ResearchCanvasPrefs,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(RESEARCH_CANVAS_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // quota / private mode — ignore
  }
}

const STATUS_STYLE: Record<
  ResearchConclusionStatus,
  { border: string; bg: string; opacity?: number }
> = {
  clear: { border: '#16a34a', bg: '#dcfce7' },
  partial: { border: '#ca8a04', bg: '#fef9c3' },
  missing: { border: '#dc2626', bg: '#fee2e2' },
  pending: { border: '#64748b', bg: '#f1f5f9' },
  pruned: { border: '#94a3b8', bg: '#f8fafc', opacity: 0.45 },
};

type ResearchRfNodeData = {
  title: string;
  conclusionStatus: ResearchConclusionStatus;
  phase?: string;
  selected?: boolean;
  highlight?: boolean;
  /** r414 failed-merge footnote on conclusion sink */
  failedMergeHint?: boolean;
  direction: ResearchCanvasDirection;
};

/** Conclusion sink: role first, then id prefix (c76) or merge-edge target. */
export function isResearchConclusionNode(
  nodeOrId: Pick<ResearchNode, 'id' | 'role'> | string,
  edges: ResearchEdge[],
): boolean {
  if (typeof nodeOrId === 'string') {
    if (nodeOrId.startsWith('node_conclusion')) return true;
    return edges.some((e) => e.kind === 'merge' && e.target === nodeOrId);
  }
  if (nodeOrId.role === 'conclusion') return true;
  if (nodeOrId.role === 'question' || nodeOrId.role === 'research') return false;
  if (nodeOrId.id.startsWith('node_conclusion')) return true;
  return edges.some((e) => e.kind === 'merge' && e.target === nodeOrId.id);
}

/**
 * Conclusion nodes that still receive merge edges from pruned research (r414).
 * Shared with Lab intent: keep topology, surface「部分汇入失败」.
 */
export function collectFailedMergeConclusionIds(
  nodes: ResearchNode[],
  edges: ResearchEdge[],
): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Set<string>();
  for (const e of edges) {
    if (e.kind !== 'merge') continue;
    const src = byId.get(e.source);
    if (!src || src.conclusionStatus !== 'pruned') continue;
    const target = byId.get(e.target);
    if (
      target ? !isResearchConclusionNode(target, edges) : !isResearchConclusionNode(e.target, edges)
    ) {
      continue;
    }
    out.add(e.target);
  }
  return out;
}

function edgeLabel(e: ResearchEdge): string {
  if (e.labelNote) return e.labelNote;
  if (e.kind === 'merge') return '汇入';
  return e.kind;
}

function ResearchFlowNode({ data }: NodeProps) {
  const d = data as ResearchRfNodeData;
  const style = STATUS_STYLE[d.conclusionStatus] ?? STATUS_STYLE.pending;
  const tb = d.direction !== 'LR';
  return (
    <div
      className="rounded-lg border-2 px-3 py-2 text-xs shadow-sm min-w-[120px] max-w-[180px]"
      style={{
        borderColor: d.highlight ? '#4f46e5' : style.border,
        background: style.bg,
        opacity: style.opacity ?? 1,
        boxShadow: d.selected ? '0 0 0 2px #6366f1' : undefined,
      }}
    >
      <Handle
        type="target"
        position={tb ? Position.Top : Position.Left}
        className="!bg-slate-400"
      />
      <div className="font-medium text-slate-800 truncate">{d.title}</div>
      {d.failedMergeHint ? (
        <div className="text-[10px] text-amber-700 mt-0.5">{FAILED_MERGE_HINT}</div>
      ) : null}
      {d.phase ? <div className="text-[10px] text-slate-500 mt-0.5">{d.phase}</div> : null}
      <Handle
        type="source"
        position={tb ? Position.Bottom : Position.Right}
        className="!bg-slate-400"
      />
    </div>
  );
}

const nodeTypes = { research: ResearchFlowNode };

function layoutNodes(
  researchNodes: ResearchNode[],
  researchEdges: ResearchEdge[],
  direction: ResearchCanvasDirection,
): { nodes: Node[]; edges: Edge[] } {
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of researchEdges) {
    const list = children.get(e.source) ?? [];
    list.push(e.target);
    children.set(e.source, list);
    hasParent.add(e.target);
  }
  const roots = researchNodes.filter((n) => !hasParent.has(n.id));
  const depth = new Map<string, number>();
  const order = new Map<string, number>();
  let counter = 0;
  const visit = (id: string, d: number) => {
    if (depth.has(id)) return;
    depth.set(id, d);
    order.set(id, counter++);
    for (const c of children.get(id) ?? []) visit(c, d + 1);
  };
  for (const r of roots) visit(r.id, 0);
  for (const n of researchNodes) {
    if (!depth.has(n.id)) visit(n.id, 0);
  }

  const byDepth = new Map<number, string[]>();
  for (const [id, d] of depth) {
    const list = byDepth.get(d) ?? [];
    list.push(id);
    byDepth.set(d, list);
  }

  const failedMergeConclusions = collectFailedMergeConclusionIds(researchNodes, researchEdges);
  const byId = new Map(researchNodes.map((n) => [n.id, n]));

  const PRIMARY_GAP = 200;
  const DEPTH_GAP = 110;
  const nodes: Node[] = researchNodes.map((n) => {
    const d = depth.get(n.id) ?? 0;
    const siblings = byDepth.get(d) ?? [n.id];
    const idx = siblings.indexOf(n.id);
    const along = (idx - (siblings.length - 1) / 2) * PRIMARY_GAP;
    const across = d * DEPTH_GAP;
    const x = direction === 'TB' ? along : across;
    const y = direction === 'TB' ? across : along;
    return {
      id: n.id,
      type: 'research',
      position: { x, y },
      sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
      targetPosition: direction === 'TB' ? Position.Top : Position.Left,
      data: {
        title: n.title,
        conclusionStatus: n.conclusionStatus,
        phase: n.phase,
        failedMergeHint: failedMergeConclusions.has(n.id),
        direction,
      } satisfies ResearchRfNodeData,
    };
  });

  // r414: mute edges that touch pruned nodes; keep merge edges +「汇入」label.
  const edges: Edge[] = researchEdges.map((e) => {
    const source = byId.get(e.source);
    const target = byId.get(e.target);
    const faded = source?.conclusionStatus === 'pruned' || target?.conclusionStatus === 'pruned';
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: edgeLabel(e),
      style: {
        stroke: faded ? '#cbd5e1' : '#94a3b8',
        strokeWidth: faded ? 1.25 : 1.5,
        opacity: faded ? 0.55 : 1,
      },
      labelStyle: faded ? { fill: '#94a3b8', fontSize: 10 } : { fill: '#64748b', fontSize: 10 },
    };
  });

  return { nodes, edges };
}

function CanvasPrefsPanel({
  prefs,
  onChange,
}: {
  prefs: ResearchCanvasPrefs;
  onChange: (next: ResearchCanvasPrefs) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white/95 p-1 shadow-sm"
      {...tid(TestIds.researchCanvasSettings)}
    >
      <button
        type="button"
        title="上下布局（TB）"
        className={`h-7 rounded-md px-2 text-[10px] font-medium ${
          prefs.direction === 'TB' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50'
        }`}
        onClick={() => onChange({ ...prefs, direction: 'TB' })}
        {...tid(TestIds.researchCanvasLayoutTb)}
      >
        TB
      </button>
      <button
        type="button"
        title="左右布局（LR）"
        className={`h-7 rounded-md px-2 text-[10px] font-medium ${
          prefs.direction === 'LR' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50'
        }`}
        onClick={() => onChange({ ...prefs, direction: 'LR' })}
        {...tid(TestIds.researchCanvasLayoutLr)}
      >
        LR
      </button>
      <button
        type="button"
        title={prefs.showMiniMap ? '隐藏小地图' : '显示小地图'}
        className={`h-7 rounded-md px-2 text-[10px] font-medium ${
          prefs.showMiniMap ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50'
        }`}
        onClick={() => onChange({ ...prefs, showMiniMap: !prefs.showMiniMap })}
        {...tid(TestIds.researchCanvasMinimap)}
      >
        小地图
      </button>
    </div>
  );
}

function InnerGraph({
  researchNodes,
  researchEdges,
  selectedNodeId,
  highlightNodeId,
  readOnly,
  onSelectNode,
  prefs,
  onPrefsChange,
}: {
  researchNodes: ResearchNode[];
  researchEdges: ResearchEdge[];
  selectedNodeId: string | null;
  highlightNodeId?: string | null;
  readOnly: boolean;
  onSelectNode: (nodeId: string | null) => void;
  prefs: ResearchCanvasPrefs;
  onPrefsChange: (next: ResearchCanvasPrefs) => void;
}) {
  const { fitView } = useReactFlow();
  const { nodes: baseNodes, edges } = useMemo(
    () => layoutNodes(researchNodes, researchEdges, prefs.direction),
    [researchNodes, researchEdges, prefs.direction],
  );

  const nodes = useMemo(
    () =>
      baseNodes.map((n) => ({
        ...n,
        data: {
          ...(n.data as ResearchRfNodeData),
          selected: n.id === selectedNodeId,
          highlight: n.id === highlightNodeId,
          direction: prefs.direction,
        },
      })),
    [baseNodes, selectedNodeId, highlightNodeId, prefs.direction],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fitView({ padding: 0.2 });
    }, 80);
    return () => window.clearTimeout(t);
  }, [nodes.length, edges.length, prefs.direction, fitView]);

  const onNodeClick = (_: MouseEvent, node: Node) => {
    onSelectNode(node.id);
  };

  const onPaneClick = () => {
    onSelectNode(null);
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodesDraggable={!readOnly}
      nodesConnectable={false}
      elementsSelectable
      fitView
      proOptions={{ hideAttribution: true }}
      className="bg-slate-50 dark:bg-slate-950"
    >
      <Background gap={16} size={1} />
      <Controls showInteractive={false} />
      {prefs.showMiniMap ? (
        <MiniMap pannable zoomable className="!bg-white/90 !border !border-gray-200 !rounded-lg" />
      ) : null}
      <Panel position="bottom-left" className="mb-1 ml-1">
        <CanvasPrefsPanel prefs={prefs} onChange={onPrefsChange} />
      </Panel>
    </ReactFlow>
  );
}

export interface ResearchGraphProps {
  nodes: ResearchNode[];
  edges: ResearchEdge[];
  selectedNodeId: string | null;
  highlightNodeId?: string | null;
  readOnly?: boolean;
  onSelectNode: (nodeId: string | null) => void;
  className?: string;
}

export default function ResearchGraph({
  nodes,
  edges,
  selectedNodeId,
  highlightNodeId,
  readOnly = false,
  onSelectNode,
  className,
}: ResearchGraphProps) {
  const [prefs, setPrefs] = useState<ResearchCanvasPrefs>(() => loadResearchCanvasPrefs());

  const onPrefsChange = (next: ResearchCanvasPrefs) => {
    setPrefs(next);
    saveResearchCanvasPrefs(next);
  };

  return (
    <div className={className ?? 'h-full w-full min-h-[280px]'} {...tid(TestIds.researchGraph)}>
      <ReactFlowProvider>
        <InnerGraph
          researchNodes={nodes}
          researchEdges={edges}
          selectedNodeId={selectedNodeId}
          highlightNodeId={highlightNodeId}
          readOnly={readOnly}
          onSelectNode={onSelectNode}
          prefs={prefs}
          onPrefsChange={onPrefsChange}
        />
      </ReactFlowProvider>
    </div>
  );
}
