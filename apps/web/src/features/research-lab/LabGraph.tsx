import type { ResearchConclusionStatus } from '@crystalith/shared';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  getBezierPath,
  getSimpleBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  type XYPosition,
} from '@xyflow/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

import { TestIds, tid } from '../../shared/testids';
import LabCanvasSettings from './LabCanvasSettings';
import { layoutWithElk, nodeProgress, type LabEdgeData, type LabRfData } from './model/labLayout';
import type {
  LabEdge,
  LabEdgePathPreset,
  LabLayoutAlgorithm,
  LabLayoutDirection,
  LabNode,
} from './model/types';

import '@xyflow/react/dist/style.css';

function labEdgePath(
  preset: LabEdgePathPreset,
  args: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition: Position;
    targetPosition: Position;
    pathOffset: number;
  },
): [string, number, number] {
  const base = {
    sourceX: args.sourceX,
    sourceY: args.sourceY,
    targetX: args.targetX,
    targetY: args.targetY,
    sourcePosition: args.sourcePosition,
    targetPosition: args.targetPosition,
  };
  switch (preset) {
    case 'straight': {
      const [path, x, y] = getStraightPath(base);
      return [path, x, y];
    }
    case 'step': {
      const [path, x, y] = getSmoothStepPath({
        ...base,
        borderRadius: 0,
        offset: args.pathOffset,
      });
      return [path, x, y];
    }
    case 'bezier': {
      const [path, x, y] = getBezierPath(base);
      return [path, x, y];
    }
    case 'simplebezier': {
      const [path, x, y] = getSimpleBezierPath(base);
      return [path, x, y];
    }
    default: {
      const [path, x, y] = getSmoothStepPath({
        ...base,
        borderRadius: 18,
        offset: args.pathOffset,
      });
      return [path, x, y];
    }
  }
}

const STATUS_STYLE: Record<
  ResearchConclusionStatus,
  { border: string; bg: string; label: string; opacity?: number }
> = {
  clear: { border: '#15803d', bg: '#dcfce7', label: '明确' },
  partial: { border: '#7e22ce', bg: '#f3e8ff', label: '待完善' },
  missing: { border: '#b91c1c', bg: '#fee2e2', label: '无法结论' },
  pending: { border: '#64748b', bg: '#f1f5f9', label: '处理中' },
  pruned: { border: '#94a3b8', bg: '#f8fafc', label: '已剪枝', opacity: 0.45 },
};

const ROLE_LABEL = {
  question: '提问',
  research: '研究',
  conclusion: '结论',
} as const;

/** Invisible connection anchors — edges still attach, dots stay hidden. */
const HIDDEN_HANDLE = '!w-2 !h-2 !min-w-0 !min-h-0 !border-0 !bg-transparent !opacity-0';

function LabFlowNode({ data }: NodeProps) {
  const d = data as LabRfData;
  const style = STATUS_STYLE[d.conclusionStatus] ?? STATUS_STYLE.pending;
  const isConclusion = d.role === 'conclusion';
  const isQuestion = d.role === 'question';
  const tb = d.direction === 'TB';
  const targetPos = tb ? Position.Top : Position.Left;
  const sourcePos = tb ? Position.Bottom : Position.Right;

  return (
    <div
      className={`lab-node-in relative rounded-xl border-2 px-3 py-2.5 text-xs shadow-sm ${
        isQuestion || isConclusion ? 'min-w-[200px] max-w-[280px]' : 'min-w-[140px] max-w-[210px]'
      } ${isConclusion ? 'ring-1 ring-amber-900/10' : ''} ${d.reshaping ? 'lab-node-reshape' : ''}`}
      style={{
        borderColor: isQuestion ? '#0f766e' : isConclusion ? '#9a3412' : style.border,
        background: isQuestion ? '#ecfdf5' : isConclusion ? '#fff7ed' : style.bg,
        opacity: style.opacity ?? 1,
        animationDelay: `${d.animDelayMs}ms`,
        boxShadow: d.selected
          ? `0 0 0 2px ${isConclusion ? '#9a3412' : isQuestion ? '#0f766e' : style.border}`
          : d.highlighted
            ? '0 0 0 2px rgba(37, 99, 235, 0.45)'
            : undefined,
      }}
    >
      <Handle type="target" position={targetPos} className={HIDDEN_HANDLE} />

      {d.role ? (
        <div className="text-[9px] uppercase tracking-wide text-slate-400 mb-0.5">
          {ROLE_LABEL[d.role]}
        </div>
      ) : null}
      <div
        className={`font-semibold truncate ${isConclusion ? 'text-amber-950' : 'text-slate-800'}`}
      >
        {d.title}
      </div>
      {d.preview ? (
        <div className="mt-1 text-[10px] leading-snug text-slate-600 line-clamp-3 whitespace-pre-wrap">
          {d.preview}
        </div>
      ) : null}

      {d.showProgress ? (
        <div className="mt-1.5">
          <div className="h-1 rounded-full bg-slate-200/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-teal-500/80 transition-all duration-700"
              style={{ width: `${d.progressPct}%` }}
            />
          </div>
          {d.statusHint ? (
            <div className="mt-0.5 text-[9px] text-slate-500 lab-status-float">{d.statusHint}</div>
          ) : null}
        </div>
      ) : !isQuestion ? (
        <div
          className="text-[10px] mt-1"
          style={{ color: isConclusion ? '#9a3412' : style.border }}
        >
          {isConclusion ? `打开节点详情 · ${d.statusOverride ?? style.label}` : style.label}
        </div>
      ) : (
        <div className="text-[10px] mt-1 text-teal-700">
          {d.askOnInterrupt === false ? '不问确认 · 可拖动' : '中断时询问 · 可拖动'}
        </div>
      )}

      {d.showProgress && d.statusHint ? (
        <div className="pointer-events-none absolute -right-1 -top-2 translate-x-full pl-1">
          <span className="lab-status-float inline-block whitespace-nowrap rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[9px] text-white/90 shadow">
            {d.statusHint}
          </span>
        </div>
      ) : null}

      <Handle type="source" position={sourcePos} className={HIDDEN_HANDLE} />
    </div>
  );
}

const LabActionEdge = memo(function LabActionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const d = data as LabEdgeData | undefined;
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = labEdgePath(d?.pathPreset ?? 'smoothstep', {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    pathOffset: d?.pathOffset ?? 28,
  });

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={28}
        className="react-flow__edge-interaction"
        style={{ cursor: d?.canFork || d?.canPrune ? 'pointer' : 'default' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {hovered ? (
            <div className="flex flex-col items-center gap-1">
              <span
                className={`rounded bg-white/95 px-1.5 py-0.5 text-[9px] border shadow-sm ${
                  d?.faded ? 'text-slate-400 border-slate-100' : 'text-slate-500 border-slate-200'
                }`}
              >
                {d?.labelNote || d?.kind || ''}
              </span>
              {d?.canFork || d?.canPrune ? (
                <div className="flex items-center gap-0.5">
                  {d.canFork ? (
                    <button
                      type="button"
                      title="沿此边分叉研究支路"
                      className="rounded-md border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-800 hover:bg-teal-100 shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        d.onFork(id);
                      }}
                    >
                      分叉
                    </button>
                  ) : null}
                  {d.canPrune ? (
                    <button
                      type="button"
                      title="淡化此研究支路（保留汇入）"
                      className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-800 hover:bg-rose-100 shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        d.onPrune(id);
                      }}
                    >
                      剪枝
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <span
              className={`rounded bg-white/80 px-1 py-0.5 text-[9px] border border-transparent ${
                d?.faded ? 'text-slate-300' : 'text-slate-400'
              }`}
            >
              {d?.labelNote || d?.kind || ''}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

const nodeTypes = { lab: LabFlowNode };
const edgeTypes = { labAction: LabActionEdge };

function Inner({
  labNodes,
  labEdges,
  selectedNodeId,
  highlightedNodeIds,
  direction,
  layoutAlgorithm,
  edgePathPreset,
  reshaping,
  onSelectNode,
  onForkEdge,
  onPruneEdge,
  onDirection,
  onAlgorithm,
  onEdgePathPreset,
}: {
  labNodes: LabNode[];
  labEdges: LabEdge[];
  selectedNodeId: string | null;
  highlightedNodeIds: string[];
  direction: LabLayoutDirection;
  layoutAlgorithm: LabLayoutAlgorithm;
  edgePathPreset: LabEdgePathPreset;
  reshaping: boolean;
  onSelectNode: (id: string | null) => void;
  onForkEdge: (edgeId: string) => void;
  onPruneEdge: (edgeId: string) => void;
  onDirection: (d: LabLayoutDirection) => void;
  onAlgorithm: (a: LabLayoutAlgorithm) => void;
  onEdgePathPreset: (p: LabEdgePathPreset) => void;
}) {
  const { fitView } = useReactFlow();
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [layoutAnim, setLayoutAnim] = useState(false);
  const layoutAnimTimer = useRef<number | null>(null);
  const dragPositions = useRef<Map<string, XYPosition>>(new Map());
  const prevDirection = useRef(direction);
  const prevAlgorithm = useRef(layoutAlgorithm);
  const wasReshaping = useRef(false);
  const lastFitTrigger = useRef('');
  const selectedRef = useRef(selectedNodeId);
  selectedRef.current = selectedNodeId;
  const graphRef = useRef({ labNodes, labEdges });
  graphRef.current = { labNodes, labEdges };
  const edgePathPresetRef = useRef(edgePathPreset);
  edgePathPresetRef.current = edgePathPreset;

  const pulseLayoutAnim = useCallback(() => {
    setLayoutAnim(true);
    if (layoutAnimTimer.current !== null) window.clearTimeout(layoutAnimTimer.current);
    layoutAnimTimer.current = window.setTimeout(() => {
      setLayoutAnim(false);
      layoutAnimTimer.current = null;
    }, 480);
  }, []);

  useEffect(() => {
    return () => {
      if (layoutAnimTimer.current !== null) window.clearTimeout(layoutAnimTimer.current);
    };
  }, []);

  const structureKey = useMemo(
    () =>
      [
        labNodes
          .map((n) => n.id)
          .toSorted()
          .join(','),
        labEdges
          .map((e) => e.id)
          .toSorted()
          .join(','),
      ].join('|'),
    [labNodes, labEdges],
  );

  // Axis / algorithm flip → drop manual positions so ELK can reclaim the canvas.
  useEffect(() => {
    if (prevDirection.current !== direction) {
      dragPositions.current.clear();
      prevDirection.current = direction;
    }
  }, [direction]);

  useEffect(() => {
    if (prevAlgorithm.current !== layoutAlgorithm) {
      dragPositions.current.clear();
      prevAlgorithm.current = layoutAlgorithm;
    }
  }, [layoutAlgorithm]);

  useEffect(() => {
    if (reshaping) dragPositions.current.clear();
  }, [reshaping]);

  // ELK only when topology / axis / algorithm / reshape changes — not on every phase status tick.
  useEffect(() => {
    let cancelled = false;
    const { labNodes: nodes, labEdges: edges } = graphRef.current;
    void layoutWithElk(
      nodes,
      edges,
      direction,
      { onFork: onForkEdge, onPrune: onPruneEdge },
      { reshaping, algorithm: layoutAlgorithm },
    ).then((result) => {
      if (cancelled) return;
      const forceElk = reshaping || dragPositions.current.size === 0;
      const nextNodes = result.nodes.map((n) => {
        const saved = dragPositions.current.get(n.id);
        if (!forceElk && saved) {
          return { ...n, position: saved, draggable: true };
        }
        dragPositions.current.set(n.id, n.position);
        return { ...n, draggable: true };
      });
      setRfNodes(
        nextNodes.map((n) => ({
          ...n,
          data: {
            ...(n.data as LabRfData),
            selected: n.id === selectedRef.current,
            reshaping: reshaping && (n.data as LabRfData).role === 'conclusion',
          },
        })),
      );
      setRfEdges(
        result.edges.map((e) => ({
          ...e,
          data: {
            ...(e.data as LabEdgeData),
            pathPreset: edgePathPresetRef.current,
          },
        })),
      );
      pulseLayoutAnim();
    });
    return () => {
      cancelled = true;
    };
    // labNodes/labEdges: structureKey already encodes topology; omit to avoid status-tick re-layout
    // eslint-disable-next-line react-hooks/exhaustive-deps -- structure-driven layout
  }, [
    structureKey,
    direction,
    layoutAlgorithm,
    reshaping,
    onForkEdge,
    onPruneEdge,
    pulseLayoutAnim,
  ]);

  // Patch xyflow path preset without re-running ELK; soft fitView after user switches.
  const edgePresetReady = useRef(false);
  useEffect(() => {
    setRfEdges((prev) =>
      prev.map((e) => ({
        ...e,
        data: {
          ...(e.data as LabEdgeData),
          pathPreset: edgePathPreset,
        },
      })),
    );
    if (!edgePresetReady.current) {
      edgePresetReady.current = true;
      return;
    }
    pulseLayoutAnim();
    const t = window.setTimeout(() => {
      void fitView({ padding: 0.22, duration: 280 });
    }, 40);
    return () => window.clearTimeout(t);
  }, [edgePathPreset, fitView, pulseLayoutAnim]);

  // Patch live fields without resetting positions (incl. progress / terminal labels).
  useEffect(() => {
    setRfNodes((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((n) => {
        const lab = labNodes.find((l) => l.id === n.id);
        if (!lab) return n;
        const d = n.data as LabRfData;
        const prog = nodeProgress(lab);
        const isConclusion = lab.role === 'conclusion';
        return {
          ...n,
          draggable: true,
          data: {
            ...d,
            title: lab.title,
            conclusionStatus: lab.conclusionStatus,
            phase: lab.phase,
            role: lab.role,
            preview:
              lab.role === 'question' || lab.role === 'conclusion'
                ? lab.conclusion || lab.summary
                : undefined,
            askOnInterrupt: lab.askOnInterrupt,
            progressPct: prog.pct,
            statusHint: prog.hint,
            showProgress: prog.show,
            statusOverride: isConclusion
              ? d.statusOverride === '部分汇入失败'
                ? d.statusOverride
                : lab.statusOverride
              : undefined,
            selected: n.id === selectedNodeId,
            highlighted: n.id !== selectedNodeId && highlightedNodeIds.includes(n.id),
            reshaping: reshaping && lab.role === 'conclusion',
          } satisfies LabRfData,
        };
      });
    });
  }, [labNodes, selectedNodeId, highlightedNodeIds, reshaping]);

  // fitView on first paint, axis/algorithm flip, topology change, or reshape pulse — never after drag.
  useEffect(() => {
    if (rfNodes.length === 0) return;
    const fitTrigger = `${direction}::${layoutAlgorithm}::${structureKey}`;
    const structureChanged = lastFitTrigger.current !== fitTrigger;
    const reshapePulse = reshaping && !wasReshaping.current;
    wasReshaping.current = reshaping;
    if (!structureChanged && !reshapePulse && lastFitTrigger.current !== '') return;
    lastFitTrigger.current = fitTrigger;
    const t = window.setTimeout(
      () => {
        void fitView({ padding: 0.22, duration: reshaping ? 420 : 280 });
      },
      reshaping ? 40 : 80,
    );
    return () => window.clearTimeout(t);
  }, [structureKey, direction, layoutAlgorithm, reshaping, fitView, rfNodes.length]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((nds) => {
      const next = applyNodeChanges(changes, nds);
      for (const c of changes) {
        if (c.type === 'position' && c.position) {
          dragPositions.current.set(c.id, c.position);
        }
      }
      return next;
    });
  }, []);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_: MouseEvent, node: Node) => onSelectNode(node.id)}
      onPaneClick={() => onSelectNode(null)}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      panOnDrag={[1, 2]}
      selectionOnDrag={false}
      zoomOnScroll
      proOptions={{ hideAttribution: true }}
      className={`bg-gray-50 lab-flow-smooth ${layoutAnim ? 'lab-flow-layout-anim' : ''} ${reshaping ? 'lab-flow-reshaping' : ''}`}
    >
      <Background gap={20} size={1} color="#e5e7eb" />
      {showMiniMap ? (
        <MiniMap
          position="top-left"
          pannable
          zoomable
          ariaLabel="思考图小地图"
          className="!m-3 !overflow-hidden !rounded-xl !border !border-gray-200 !bg-white/95 !shadow-sm"
          maskColor="rgb(15 23 42 / 0.08)"
          nodeStrokeWidth={2}
          nodeColor={(n) => {
            const role = (n.data as LabRfData | undefined)?.role;
            if (role === 'question') return '#3b82f6';
            if (role === 'conclusion') return '#f59e0b';
            return '#64748b';
          }}
        />
      ) : null}
      {/* Zoom stack (default bottom-left) + canvas chip immediately to its right */}
      <Controls
        showInteractive={false}
        position="bottom-left"
        className="!shadow-sm !border-gray-200 !rounded-lg"
      />
      <Panel position="bottom-left" className="!m-0 !mb-3 !ml-[52px]">
        <LabCanvasSettings
          direction={direction}
          onDirection={onDirection}
          algorithm={layoutAlgorithm}
          onAlgorithm={onAlgorithm}
          edgePathPreset={edgePathPreset}
          onEdgePathPreset={onEdgePathPreset}
          showMiniMap={showMiniMap}
          onShowMiniMap={setShowMiniMap}
        />
      </Panel>
    </ReactFlow>
  );
}

export const LAB_STATUS_LEGEND = STATUS_STYLE;

export default function LabGraph({
  nodes,
  edges,
  selectedNodeId,
  highlightedNodeIds = [],
  direction = 'TB',
  layoutAlgorithm = 'layered',
  edgePathPreset = 'smoothstep',
  reshaping = false,
  onSelectNode,
  onForkEdge,
  onPruneEdge,
  onDirection,
  onAlgorithm,
  onEdgePathPreset,
  className,
}: {
  nodes: LabNode[];
  edges: LabEdge[];
  selectedNodeId: string | null;
  highlightedNodeIds?: string[];
  direction?: LabLayoutDirection;
  layoutAlgorithm?: LabLayoutAlgorithm;
  edgePathPreset?: LabEdgePathPreset;
  reshaping?: boolean;
  onSelectNode: (id: string | null) => void;
  onForkEdge: (edgeId: string) => void;
  onPruneEdge: (edgeId: string) => void;
  onDirection: (d: LabLayoutDirection) => void;
  onAlgorithm: (a: LabLayoutAlgorithm) => void;
  onEdgePathPreset: (p: LabEdgePathPreset) => void;
  className?: string;
}) {
  return (
    <div className={className ?? 'h-full w-full min-h-[320px]'} {...tid(TestIds.researchLabGraph)}>
      <ReactFlowProvider>
        <Inner
          labNodes={nodes}
          labEdges={edges}
          selectedNodeId={selectedNodeId}
          highlightedNodeIds={highlightedNodeIds}
          direction={direction}
          layoutAlgorithm={layoutAlgorithm}
          edgePathPreset={edgePathPreset}
          reshaping={reshaping}
          onSelectNode={onSelectNode}
          onForkEdge={onForkEdge}
          onPruneEdge={onPruneEdge}
          onDirection={onDirection}
          onAlgorithm={onAlgorithm}
          onEdgePathPreset={onEdgePathPreset}
        />
      </ReactFlowProvider>
    </div>
  );
}
