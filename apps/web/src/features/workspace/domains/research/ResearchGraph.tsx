import type { ResearchConclusionStatus, ResearchEdge, ResearchNode } from '@crystalith/shared';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { useEffect, useMemo, type MouseEvent } from 'react';

import { TestIds, tid } from '../../../../shared/testids';

import '@xyflow/react/dist/style.css';

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
};

function ResearchFlowNode({ data }: NodeProps) {
  const d = data as ResearchRfNodeData;
  const style = STATUS_STYLE[d.conclusionStatus] ?? STATUS_STYLE.pending;
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
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className="font-medium text-slate-800 truncate">{d.title}</div>
      {d.phase ? <div className="text-[10px] text-slate-500 mt-0.5">{d.phase}</div> : null}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  );
}

const nodeTypes = { research: ResearchFlowNode };

function layoutNodes(
  researchNodes: ResearchNode[],
  researchEdges: ResearchEdge[],
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

  const X_GAP = 200;
  const Y_GAP = 110;
  const nodes: Node[] = researchNodes.map((n) => {
    const d = depth.get(n.id) ?? 0;
    const siblings = byDepth.get(d) ?? [n.id];
    const idx = siblings.indexOf(n.id);
    const x = (idx - (siblings.length - 1) / 2) * X_GAP;
    const y = d * Y_GAP;
    return {
      id: n.id,
      type: 'research',
      position: { x, y },
      data: {
        title: n.title,
        conclusionStatus: n.conclusionStatus,
        phase: n.phase,
      } satisfies ResearchRfNodeData,
    };
  });

  const edges: Edge[] = researchEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.labelNote || e.kind,
    style: { stroke: '#94a3b8' },
  }));

  return { nodes, edges };
}

function InnerGraph({
  researchNodes,
  researchEdges,
  selectedNodeId,
  highlightNodeId,
  readOnly,
  onSelectNode,
}: {
  researchNodes: ResearchNode[];
  researchEdges: ResearchEdge[];
  selectedNodeId: string | null;
  highlightNodeId?: string | null;
  readOnly: boolean;
  onSelectNode: (nodeId: string | null) => void;
}) {
  const { fitView } = useReactFlow();
  const { nodes: baseNodes, edges } = useMemo(
    () => layoutNodes(researchNodes, researchEdges),
    [researchNodes, researchEdges],
  );

  const nodes = useMemo(
    () =>
      baseNodes.map((n) => ({
        ...n,
        data: {
          ...(n.data as ResearchRfNodeData),
          selected: n.id === selectedNodeId,
          highlight: n.id === highlightNodeId,
        },
      })),
    [baseNodes, selectedNodeId, highlightNodeId],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fitView({ padding: 0.2 });
    }, 80);
    return () => window.clearTimeout(t);
  }, [nodes.length, edges.length, fitView]);

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
        />
      </ReactFlowProvider>
    </div>
  );
}
