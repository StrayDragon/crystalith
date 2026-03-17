/**
 * MindmapViewer - Interactive mindmap using React Flow
 *
 * Features:
 * - Hierarchical tree layout
 * - Zoom and pan (using React Flow's canvas)
 * - Collapsible nodes with auto-collapse by depth
 * - Color-coded depth levels
 */

import { useCallback, useMemo, useState, memo, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  BaseEdge,
  getStraightPath,
  useReactFlow,
  type NodeProps,
  type EdgeProps,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useTheme } from "../../shared/hooks/useTheme";

// ============================================================================
// Types
// ============================================================================

export interface MindmapNode {
  label: string;
  children?: MindmapNode[];
}

export interface MindmapData {
  root: MindmapNode;
}

interface MindmapViewerProps {
  data: MindmapData;
  className?: string;
  autoCollapseDepth?: number;
}

interface NodeData {
  label: string;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
  childCount: number;
  [key: string]: unknown; // Index signature for React Flow compatibility
}

// ============================================================================
// Constants
// ============================================================================

const NODE_WIDTH = 180;
const NODE_HEIGHT = 40;
const H_SPACING = 80;
const V_SPACING = 20;

const COLORS = [
  { bg: "#1a73e8", text: "#fff", border: "#1557b0" },
  { bg: "#34a853", text: "#fff", border: "#2d8e47" },
  { bg: "#fbbc04", text: "#333", border: "#e0a800" },
  { bg: "#ea4335", text: "#fff", border: "#c5382c" },
  { bg: "#9c27b0", text: "#fff", border: "#7b1fa2" },
  { bg: "#00bcd4", text: "#fff", border: "#0097a7" },
];

const getColor = (depth: number) => COLORS[Math.min(depth, COLORS.length - 1)];

// ============================================================================
// Custom Node (memoized)
// ============================================================================

interface MindmapNodeProps extends NodeProps {
  data: NodeData;
}

const MindmapNodeComponent = memo(function MindmapNodeComponent({ data, id }: MindmapNodeProps) {
  const { label, depth, hasChildren, collapsed, childCount } = data;
  const color = getColor(depth);

  return (
    <div
      data-nodeid={id}
      style={{
        padding: "8px 16px",
        paddingRight: hasChildren ? "32px" : "16px",
        borderRadius: depth === 0 ? "8px" : "4px",
        background: color.bg,
        color: color.text,
        border: `2px solid ${color.border}`,
        fontSize: depth === 0 ? "14px" : "13px",
        fontWeight: depth === 0 ? 600 : 500,
        maxWidth: NODE_WIDTH,
        textAlign: "center",
        boxShadow: depth === 0 ? "0 4px 12px rgba(0,0,0,0.15)" : "0 2px 6px rgba(0,0,0,0.1)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        position: "relative",
        cursor: hasChildren ? "pointer" : "default",
      }}
    >
      {depth > 0 && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: color.border, border: "none", width: 6, height: 6 }}
        />
      )}
      {label}
      {hasChildren && (
        <span
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: `1px solid ${color.border}`,
            background: collapsed ? color.border : "rgba(255,255,255,0.3)",
            color: collapsed ? color.bg : color.text,
            fontSize: 11,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {collapsed ? childCount : "−"}
        </span>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: color.border,
          border: "none",
          width: 6,
          height: 6,
          opacity: hasChildren && !collapsed ? 1 : 0.3,
        }}
      />
    </div>
  );
});

const nodeTypes = { mindmap: MindmapNodeComponent };

// ============================================================================
// Custom Edge (memoized, simple straight line)
// ============================================================================

const MindmapEdge = memo(function MindmapEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
}: EdgeProps) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  return <BaseEdge id={id} path={path} style={style} />;
});

const edgeTypes: EdgeTypes = { mindmap: MindmapEdge };

// ============================================================================
// Layout Algorithm
// ============================================================================

interface LayoutNode {
  id: string;
  label: string;
  depth: number;
  children: LayoutNode[];
  childCount: number;
  height: number;
  y: number;
}

function buildTree(
  node: MindmapNode,
  depth: number,
  prefix: string,
  collapsed: Set<string>,
): LayoutNode {
  const id = prefix;
  const isCollapsed = collapsed.has(id);
  const childCount = node.children?.length || 0;
  const children = isCollapsed
    ? []
    : (node.children || []).map((c, i) => buildTree(c, depth + 1, `${prefix}-${i}`, collapsed));
  const height =
    children.length === 0
      ? NODE_HEIGHT
      : children.reduce((sum, c) => sum + c.height, 0) + (children.length - 1) * V_SPACING;
  return { id, label: node.label, depth, children, childCount, height, y: 0 };
}

function layoutY(node: LayoutNode, startY: number): void {
  if (node.children.length === 0) {
    node.y = startY;
    return;
  }
  let y = startY;
  for (const c of node.children) {
    layoutY(c, y);
    y += c.height + V_SPACING;
  }
  node.y = (node.children[0].y + node.children[node.children.length - 1].y) / 2;
}

function flatten(node: LayoutNode, collapsed: Set<string>, nodes: Node[], edges: Edge[]): void {
  const x = node.depth * (NODE_WIDTH + H_SPACING);
  const isCollapsed = collapsed.has(node.id);
  nodes.push({
    id: node.id,
    type: "mindmap",
    position: { x, y: node.y },
    draggable: false,
    data: {
      label: node.label,
      depth: node.depth,
      hasChildren: node.childCount > 0,
      collapsed: isCollapsed,
      childCount: node.childCount,
    } as NodeData,
  });
  for (const c of node.children) {
    edges.push({
      id: `${node.id}->${c.id}`,
      source: node.id,
      target: c.id,
      type: "mindmap",
      style: { stroke: getColor(node.depth).border, strokeWidth: Math.max(1, 3 - node.depth) },
    });
    flatten(c, collapsed, nodes, edges);
  }
}

function buildElements(
  data: MindmapData,
  collapsed: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  if (!data?.root) return { nodes: [], edges: [] };
  const tree = buildTree(data.root, 0, "root", collapsed);
  layoutY(tree, 0);
  const nodes: Node[] = [],
    edges: Edge[] = [];
  flatten(tree, collapsed, nodes, edges);
  return { nodes, edges };
}

function getAutoCollapsed(
  node: MindmapNode,
  depth: number,
  prefix: string,
  maxDepth: number,
): Set<string> {
  const set = new Set<string>();
  const traverse = (n: MindmapNode, d: number, p: string) => {
    if (d >= maxDepth && n.children?.length) set.add(p);
    (n.children || []).forEach((c, i) => traverse(c, d + 1, `${p}-${i}`));
  };
  if (maxDepth > 0) traverse(node, depth, prefix);
  return set;
}

// ============================================================================
// Inner Flow Component (needs ReactFlowProvider context)
// ============================================================================

interface InnerFlowProps {
  data: MindmapData;
  autoCollapseDepth: number;
  isDarkTheme: boolean;
}

function InnerFlow({ data, autoCollapseDepth, isDarkTheme }: InnerFlowProps) {
  const { fitView } = useReactFlow();

  const [collapsed, setCollapsed] = useState(() =>
    getAutoCollapsed(data?.root, 0, "root", autoCollapseDepth),
  );

  const { nodes, edges } = useMemo(() => buildElements(data, collapsed), [data, collapsed]);

  // Fit view when nodes change
  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.2 }), 100);
    return () => clearTimeout(timer);
  }, [nodes, fitView]);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  const collapseAll = useCallback(() => {
    if (!data?.root) return;
    const all = new Set<string>();
    const visit = (n: MindmapNode, p: string) => {
      if (n.children?.length) {
        all.add(p);
        n.children.forEach((c, i) => visit(c, `${p}-${i}`));
      }
    };
    if (data.root.children?.length) all.add("root");
    data.root.children?.forEach((c, i) => visit(c, `root-${i}`));
    setCollapsed(all);
  }, [data]);

  // Handle node click for toggle
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const nodeData = node.data as NodeData;
      if (nodeData.hasChildren) {
        toggle(node.id);
      }
    },
    [toggle],
  );

  return (
    <>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <button type="button" onClick={expandAll} style={isDarkTheme ? btnStyleDark : btnStyle}>
          展开
        </button>
        <button type="button" onClick={collapseAll} style={isDarkTheme ? btnStyleDark : btnStyle}>
          折叠
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
        // Static display - no dragging
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        // Pan and zoom
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        minZoom={0.1}
        maxZoom={2}
        // Performance
        edgesFocusable={false}
        nodesFocusable={false}
        edgesReconnectable={false}
      >
        <Controls
          position="top-right"
          showInteractive={false}
          className={
            isDarkTheme
              ? "!bg-slate-800 !border-slate-700 !shadow-lg [&_button]:!bg-slate-700 [&_button]:!border-slate-600 [&_button]:!text-slate-300 [&_button:hover]:!bg-slate-600"
              : "!bg-white !border-gray-200 !shadow-md [&_button]:!bg-white [&_button]:!border-gray-200 [&_button]:!text-gray-600 [&_button:hover]:!bg-gray-100"
          }
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color={isDarkTheme ? "#334155" : "#e0e0e0"}
        />
      </ReactFlow>
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MindmapViewer({ data, className, autoCollapseDepth = 3 }: MindmapViewerProps) {
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === "dark";

  if (!data?.root) {
    return (
      <div className={className} style={{ padding: 16, color: isDarkTheme ? "#94a3b8" : "#666" }}>
        无效的思维导图数据
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${className ?? ""}`.trim()}
      style={{ width: "100%", height: 400, minHeight: 300, position: "relative" }}
    >
      <ReactFlowProvider>
        <InnerFlow data={data} autoCollapseDepth={autoCollapseDepth} isDarkTheme={isDarkTheme} />
      </ReactFlowProvider>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const toolbarStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  zIndex: 10,
  display: "flex",
  gap: 4,
};

const btnStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  borderRadius: 4,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  color: "#333",
};

const btnStyleDark: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  borderRadius: 4,
  border: "1px solid #475569",
  background: "#1e293b",
  cursor: "pointer",
  color: "#cbd5e1",
};

export default MindmapViewer;
