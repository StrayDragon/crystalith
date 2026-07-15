import { IconButton, Typography, Chip, Tooltip, Button, Spinner } from '@material-tailwind/react';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Hub as HubIcon,
  Description as DescriptionIcon,
  AutoAwesome as OutputIcon,
  Chat as ChatIcon,
  Warning as WarningIcon,
  OpenInNew as OpenInNewIcon,
  CenterFocusStrong as ResetLayoutIcon,
} from '@mui/icons-material';
import '@xyflow/react/dist/style.css';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
  ConnectionMode,
  Panel,
} from '@xyflow/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AnalysisResult } from '../../../../api/shared-types';
import { useLayer } from '../../../../shared/layer';
import { useTheme } from '../../shared/hooks/useTheme';
import type { SourceItem, OutputItem, SessionSummary, ChatMessage } from '../../shared/types';

// Cache for node positions (survives component unmount within session)
const nodePositionsCache = new Map<string, { x: number; y: number }>();

// Node type definitions
type KnowledgeNodeType = 'source' | 'output' | 'session';

// Color schemes for different node types
const NODE_COLORS = {
  source: {
    bg: '#EFF6FF',
    border: '#BFDBFE',
    text: '#1D4ED8',
    node: '#3B82F6',
    label: '来源',
  },
  output: {
    bg: '#F5F3FF',
    border: '#DDD6FE',
    text: '#6D28D9',
    node: '#8B5CF6',
    label: '产出',
  },
  session: {
    bg: '#F0FDF4',
    border: '#BBF7D0',
    text: '#15803D',
    node: '#22C55E',
    label: '对话',
  },
};

// Topic colors for sources
const TOPIC_COLORS = [
  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', node: '#3B82F6' },
  { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', node: '#22C55E' },
  { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', node: '#F59E0B' },
  { bg: '#FAF5FF', border: '#E9D5FF', text: '#7E22CE', node: '#A855F7' },
  { bg: '#FFF1F2', border: '#FECDD3', text: '#BE123C', node: '#F43F5E' },
  { bg: '#F0FDFA', border: '#99F6E4', text: '#0F766E', node: '#14B8A6' },
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#4338CA', node: '#6366F1' },
  { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C', node: '#F97316' },
];

interface KnowledgeGraphViewProps {
  sources: SourceItem[];
  outputs: OutputItem[];
  sessions: SessionSummary[];
  messages: ChatMessage[];
  analysis: AnalysisResult | null;
  isLoading: boolean;
  error: string;
  activeSessionId?: number | null;
  onClose: () => void;
  onRefresh: () => void;
  onSourceClick: (source: SourceItem) => void;
  onOutputClick?: (output: OutputItem) => void;
  onSessionClick?: (session: SessionSummary) => void;
  isConnected: boolean;
}

interface KnowledgeNodeData extends Record<string, unknown> {
  nodeType: KnowledgeNodeType;
  id: number;
  title: string;
  subtitle?: string;
  topicIndex?: number | null;
  relationCount: number;
  hasContradiction: boolean;
  isSelected: boolean;
  onClick: () => void;
}

// Custom Knowledge Node Component
function KnowledgeNode({ data }: NodeProps<Node<KnowledgeNodeData>>) {
  const {
    nodeType,
    title,
    subtitle,
    topicIndex,
    relationCount,
    hasContradiction,
    isSelected,
    onClick,
  } = data;

  const baseColor = NODE_COLORS[nodeType];
  // For sources with topics, use topic color
  const color =
    nodeType === 'source' && typeof topicIndex === 'number'
      ? TOPIC_COLORS[topicIndex % TOPIC_COLORS.length]
      : baseColor;

  const Icon =
    nodeType === 'source' ? DescriptionIcon : nodeType === 'output' ? OutputIcon : ChatIcon;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />
      <button
        type="button"
        className={`
          relative px-3 py-2 rounded-xl shadow-lg cursor-pointer transition-all duration-200
          hover:shadow-xl hover:scale-105
          ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        `}
        style={{
          backgroundColor: color.bg,
          borderWidth: 2,
          borderColor: hasContradiction ? '#F87171' : color.border,
          minWidth: 100,
          maxWidth: 160,
        }}
        onClick={onClick}
      >
        {/* Contradiction indicator */}
        {hasContradiction && (
          <div className="absolute -top-1 -right-1">
            <Tooltip content="存在潜在矛盾">
              <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <WarningIcon style={{ fontSize: 10 }} className="text-white" />
              </div>
            </Tooltip>
          </div>
        )}

        {/* Node type badge */}
        <div
          className="absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: baseColor.node }}
        >
          <Icon style={{ fontSize: 12 }} className="text-white" />
        </div>

        {/* Title */}
        <Typography
          variant="small"
          className="font-semibold text-xs truncate pl-2"
          style={{ color: color.text }}
        >
          {title}
        </Typography>

        {/* Subtitle */}
        {subtitle && (
          <Typography
            variant="small"
            className="text-[10px] text-gray-500 truncate pl-2 dark:text-gray-400"
          >
            {subtitle}
          </Typography>
        )}

        {/* Stats */}
        {relationCount > 0 && (
          <div className="flex items-center gap-1 mt-1 pl-2">
            <Chip
              value={`${relationCount} 关联`}
              size="sm"
              className="bg-white/80 text-gray-600 text-[8px] h-4 py-0 px-1 font-medium dark:bg-slate-900/70 dark:text-slate-200"
            />
          </div>
        )}
      </button>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />
    </>
  );
}

const nodeTypes = {
  knowledgeNode: KnowledgeNode,
};

interface VisibilityState {
  sources: boolean;
  outputs: boolean;
  sessions: boolean;
}

// Build graph data
function buildGraphData(
  sources: SourceItem[],
  outputs: OutputItem[],
  sessions: SessionSummary[],
  messages: ChatMessage[],
  analysis: AnalysisResult | null,
  visibility: VisibilityState,
  selectedId: string | null,
  onSourceClick: (source: SourceItem) => void,
  onOutputClick?: (output: OutputItem) => void,
  onSessionClick?: (session: SessionSummary) => void,
  activeSessionId?: number | null,
): { nodes: Node<KnowledgeNodeData>[]; edges: Edge[] } {
  const nodes: Node<KnowledgeNodeData>[] = [];
  const edges: Edge[] = [];

  // Map chunk_id to source_id using ranges to avoid large maps.
  const chunkRanges: Array<{ start: number; end: number; sourceId: number }> = [];
  let chunkOffset = 0;
  for (const source of sources) {
    const start = chunkOffset + 1;
    const end = chunkOffset + source.chunks;
    if (source.chunks > 0) {
      chunkRanges.push({ start, end, sourceId: source.id });
    }
    chunkOffset = end;
  }
  const findSourceForChunk = (chunkId: number): number | undefined => {
    let low = 0;
    let high = chunkRanges.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const range = chunkRanges[mid];
      if (chunkId < range.start) {
        high = mid - 1;
      } else if (chunkId > range.end) {
        low = mid + 1;
      } else {
        return range.sourceId;
      }
    }
    return undefined;
  };

  // Calculate topic assignment for each source
  const sourceToTopic = new Map<number, number>();
  if (analysis?.topics) {
    (analysis.topics as Array<Record<string, unknown>>).forEach(
      (topic: Record<string, unknown>, index: number) => {
        for (const chunkId of topic.chunk_ids as number[]) {
          const sourceId = findSourceForChunk(chunkId);
          if (sourceId !== undefined && !sourceToTopic.has(sourceId)) {
            sourceToTopic.set(sourceId, index);
          }
        }
      },
    );
  }

  // Calculate relations between sources
  const sourceRelations = new Map<
    string,
    { count: number; maxScore: number; isContradiction: boolean }
  >();
  const sourceRelationCount = new Map<number, number>();
  const sourceHasContradiction = new Set<number>();

  if (analysis?.relations) {
    for (const relation of analysis.relations) {
      const sourceA = findSourceForChunk(relation.source_chunk_id);
      const sourceB = findSourceForChunk(relation.target_chunk_id);
      if (sourceA !== undefined && sourceB !== undefined && sourceA !== sourceB) {
        const key = [Math.min(sourceA, sourceB), Math.max(sourceA, sourceB)].join('-');
        const existing = sourceRelations.get(key);
        sourceRelations.set(key, {
          count: (existing?.count || 0) + 1,
          maxScore: Math.max(existing?.maxScore || 0, relation.score),
          isContradiction: existing?.isContradiction || relation.relation_type === 'contradicts',
        });
        sourceRelationCount.set(sourceA, (sourceRelationCount.get(sourceA) || 0) + 1);
        sourceRelationCount.set(sourceB, (sourceRelationCount.get(sourceB) || 0) + 1);
      }
    }
  }

  if (analysis?.contradictions) {
    for (const c of analysis.contradictions) {
      const sourceA = findSourceForChunk(c.source_chunk_id);
      const sourceB = findSourceForChunk(c.target_chunk_id);
      if (sourceA !== undefined) sourceHasContradiction.add(sourceA);
      if (sourceB !== undefined) sourceHasContradiction.add(sourceB);
    }
  }

  // Calculate output → source relations
  const outputSourceRelations = new Map<number, Set<number>>();
  for (const output of outputs) {
    if (output.chunkIds && output.chunkIds.length > 0) {
      const sourceIds = new Set<number>();
      for (const chunkId of output.chunkIds) {
        const sourceId = findSourceForChunk(chunkId);
        if (sourceId !== undefined) {
          sourceIds.add(sourceId);
        }
      }
      if (sourceIds.size > 0) {
        outputSourceRelations.set(output.id, sourceIds);
      }
    }
  }

  // Calculate session → source relations (via messages with citations)
  const sessionSourceRelations = new Map<number, Set<number>>();
  const targetSessionId = activeSessionId ?? sessions[0]?.id ?? null;
  if (targetSessionId !== null) {
    const sourceIds = new Set<number>();
    for (const message of messages) {
      if (message.citations && message.citations.length > 0) {
        for (const citation of message.citations) {
          if (citation.chunkId !== null) {
            const sourceId = findSourceForChunk(citation.chunkId);
            if (sourceId !== undefined) {
              sourceIds.add(sourceId);
            }
          }
        }
      }
    }
    if (sourceIds.size > 0) {
      sessionSourceRelations.set(targetSessionId, sourceIds);
    }
  }

  // Layout calculation
  const visibleSources = visibility.sources ? sources : [];
  const visibleOutputs = visibility.outputs ? outputs : [];
  const visibleSessions = visibility.sessions ? sessions : [];

  const totalNodes = visibleSources.length + visibleOutputs.length + visibleSessions.length;
  if (totalNodes === 0) {
    return { nodes: [], edges: [] };
  }

  // Circular layout with different radii for different types
  const centerX = 450;
  const centerY = 350;
  const sourceRadius = Math.max(180, visibleSources.length * 30);
  const outputRadius = sourceRadius + 120;
  const sessionRadius = outputRadius + 100;

  // Add source nodes
  visibleSources.forEach((source, index) => {
    const angle = (2 * Math.PI * index) / Math.max(visibleSources.length, 1) - Math.PI / 2;
    nodes.push({
      id: `source-${source.id}`,
      type: 'knowledgeNode',
      position: {
        x: centerX + sourceRadius * Math.cos(angle),
        y: centerY + sourceRadius * Math.sin(angle),
      },
      data: {
        nodeType: 'source',
        id: source.id,
        title: source.title,
        subtitle: `${source.chunks} 片段`,
        topicIndex: sourceToTopic.get(source.id) ?? null,
        relationCount: sourceRelationCount.get(source.id) || 0,
        hasContradiction: sourceHasContradiction.has(source.id),
        isSelected: selectedId === `source-${source.id}`,
        onClick: () => onSourceClick(source),
      },
    });
  });

  // Add output nodes
  visibleOutputs.forEach((output, index) => {
    const angle = (2 * Math.PI * index) / Math.max(visibleOutputs.length, 1) - Math.PI / 2;
    const relatedSources = outputSourceRelations.get(output.id);
    nodes.push({
      id: `output-${output.id}`,
      type: 'knowledgeNode',
      position: {
        x: centerX + outputRadius * Math.cos(angle),
        y: centerY + outputRadius * Math.sin(angle),
      },
      data: {
        nodeType: 'output',
        id: output.id,
        title: output.prompt.slice(0, 20) + (output.prompt.length > 20 ? '...' : ''),
        subtitle: output.type,
        relationCount: relatedSources?.size || 0,
        hasContradiction: false,
        isSelected: selectedId === `output-${output.id}`,
        onClick: () => onOutputClick?.(output),
      },
    });
  });

  // Add session nodes
  visibleSessions.forEach((session, index) => {
    const angle = (2 * Math.PI * index) / Math.max(visibleSessions.length, 1) - Math.PI / 2;
    const relatedSources = sessionSourceRelations.get(session.id);
    nodes.push({
      id: `session-${session.id}`,
      type: 'knowledgeNode',
      position: {
        x: centerX + sessionRadius * Math.cos(angle),
        y: centerY + sessionRadius * Math.sin(angle),
      },
      data: {
        nodeType: 'session',
        id: session.id,
        title: session.title || `对话 ${session.id}`,
        relationCount: relatedSources?.size || 0,
        hasContradiction: false,
        isSelected: selectedId === `session-${session.id}`,
        onClick: () => onSessionClick?.(session),
      },
    });
  });

  // Add source ↔ source edges
  if (visibility.sources) {
    sourceRelations.forEach((relation, key) => {
      const [sourceA, sourceB] = key.split('-').map(Number);
      edges.push({
        id: `source-edge-${key}`,
        source: `source-${sourceA}`,
        target: `source-${sourceB}`,
        animated: relation.isContradiction,
        style: {
          stroke: relation.isContradiction ? '#F87171' : '#9CA3AF',
          strokeWidth: Math.max(1, Math.min(3, relation.maxScore * 4)),
          opacity: Math.max(0.3, relation.maxScore),
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: relation.isContradiction ? '#F87171' : '#9CA3AF',
        },
      });
    });
  }

  // Add output → source edges
  if (visibility.outputs && visibility.sources) {
    outputSourceRelations.forEach((sourceIds, outputId) => {
      sourceIds.forEach((sourceId) => {
        edges.push({
          id: `output-source-${outputId}-${sourceId}`,
          source: `output-${outputId}`,
          target: `source-${sourceId}`,
          style: {
            stroke: NODE_COLORS.output.node,
            strokeWidth: 1.5,
            opacity: 0.6,
            strokeDasharray: '4 2',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: NODE_COLORS.output.node,
          },
        });
      });
    });
  }

  // Add session → source edges
  if (visibility.sessions && visibility.sources) {
    sessionSourceRelations.forEach((sourceIds, sessionId) => {
      sourceIds.forEach((sourceId) => {
        edges.push({
          id: `session-source-${sessionId}-${sourceId}`,
          source: `session-${sessionId}`,
          target: `source-${sourceId}`,
          style: {
            stroke: NODE_COLORS.session.node,
            strokeWidth: 1.5,
            opacity: 0.5,
            strokeDasharray: '6 3',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: NODE_COLORS.session.node,
          },
        });
      });
    });
  }

  return { nodes, edges };
}

// Selected item type for detail panel
type SelectedItem =
  | { type: 'source'; data: SourceItem }
  | { type: 'output'; data: OutputItem }
  | { type: 'session'; data: SessionSummary }
  | null;

function KnowledgeGraphView({
  sources,
  outputs,
  sessions,
  messages,
  analysis,
  isLoading,
  error,
  activeSessionId,
  onClose,
  onRefresh,
  onSourceClick,
  onOutputClick,
  onSessionClick,
  isConnected,
}: KnowledgeGraphViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [visibility, setVisibility] = useState<VisibilityState>({
    sources: true,
    outputs: true,
    sessions: true,
  });

  // Click handlers only select, don't call external callbacks
  const handleSourceClick = useCallback((source: SourceItem) => {
    setSelectedId(`source-${source.id}`);
    setSelectedItem({ type: 'source', data: source });
  }, []);

  const handleOutputClick = useCallback((output: OutputItem) => {
    setSelectedId(`output-${output.id}`);
    setSelectedItem({ type: 'output', data: output });
  }, []);

  const handleSessionClick = useCallback((session: SessionSummary) => {
    setSelectedId(`session-${session.id}`);
    setSelectedItem({ type: 'session', data: session });
  }, []);

  // Open detail (keep graph open, let dialog overlay on top)
  const handleOpenDetail = useCallback(() => {
    if (!selectedItem) return;

    if (selectedItem.type === 'source') {
      onSourceClick(selectedItem.data);
    } else if (selectedItem.type === 'output') {
      onOutputClick?.(selectedItem.data);
    } else if (selectedItem.type === 'session') {
      onSessionClick?.(selectedItem.data);
    }
    // Don't close graph - let the detail dialog overlay on top
    // User can close graph manually via the close button
  }, [selectedItem, onSourceClick, onOutputClick, onSessionClick]);

  // Apply cached positions to nodes
  const applyPositionsFromCache = useCallback((nodesData: Node<KnowledgeNodeData>[]) => {
    return nodesData.map((node) => {
      const cachedPosition = nodePositionsCache.get(node.id);
      if (cachedPosition) {
        return { ...node, position: cachedPosition };
      }
      return node;
    });
  }, []);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const { nodes, edges } = buildGraphData(
      sources,
      outputs,
      sessions,
      messages,
      analysis,
      visibility,
      selectedId,
      handleSourceClick,
      handleOutputClick,
      handleSessionClick,
      activeSessionId,
    );
    // Apply cached positions to initial nodes
    return { nodes: applyPositionsFromCache(nodes), edges };
    // Only regenerate initial layout when data actually changes, not just selectedId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sources,
    outputs,
    sessions,
    messages,
    analysis,
    visibility,
    handleSourceClick,
    handleOutputClick,
    handleSessionClick,
    activeSessionId,
    applyPositionsFromCache,
  ]);

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Wrap onNodesChange to save positions to cache
  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      onNodesChangeBase(changes);
      // Save position changes to cache
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          nodePositionsCache.set(change.id, { x: change.position.x, y: change.position.y });
        }
      }
    },
    [onNodesChangeBase],
  );

  // Reset positions function
  const handleResetPositions = useCallback(() => {
    // Clear cache
    nodePositionsCache.clear();
    // Rebuild graph with fresh positions
    const { nodes: newNodes, edges: newEdges } = buildGraphData(
      sources,
      outputs,
      sessions,
      messages,
      analysis,
      visibility,
      selectedId,
      handleSourceClick,
      handleOutputClick,
      handleSessionClick,
      activeSessionId,
    );
    setNodes(newNodes);
    setEdges(newEdges);
  }, [
    sources,
    outputs,
    sessions,
    messages,
    analysis,
    visibility,
    selectedId,
    handleSourceClick,
    handleOutputClick,
    handleSessionClick,
    activeSessionId,
    setNodes,
    setEdges,
  ]);

  // Track if we need full rebuild (data changed) vs just selection update
  const prevDataRef = useRef({ sources, outputs, sessions, analysis, visibility });

  useEffect(() => {
    const prevData = prevDataRef.current;
    const dataChanged =
      prevData.sources !== sources ||
      prevData.outputs !== outputs ||
      prevData.sessions !== sessions ||
      prevData.analysis !== analysis ||
      prevData.visibility !== visibility;

    if (dataChanged) {
      // Full rebuild when actual data changes, but preserve cached positions
      const { nodes: newNodes, edges: newEdges } = buildGraphData(
        sources,
        outputs,
        sessions,
        messages,
        analysis,
        visibility,
        selectedId,
        handleSourceClick,
        handleOutputClick,
        handleSessionClick,
        activeSessionId,
      );
      setNodes(applyPositionsFromCache(newNodes));
      setEdges(newEdges);
      prevDataRef.current = { sources, outputs, sessions, analysis, visibility };
    } else {
      // Only update selection state, preserve positions
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isSelected: node.id === selectedId,
          },
        })),
      );
    }
  }, [
    sources,
    outputs,
    sessions,
    messages,
    analysis,
    visibility,
    selectedId,
    handleSourceClick,
    handleOutputClick,
    handleSessionClick,
    activeSessionId,
    setNodes,
    setEdges,
    applyPositionsFromCache,
  ]);

  const toggleVisibility = (type: keyof VisibilityState) => {
    setVisibility((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  // Stats
  const contradictionCount = analysis?.contradictions?.length || 0;
  const totalNodes = sources.length + outputs.length + sessions.length;

  const { style: modalStyle } = useLayer('modal');
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';

  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900/95 flex flex-col" style={modalStyle}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/90 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/90">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <HubIcon className="text-blue-400" style={{ fontSize: 24 }} />
            <Typography variant="h6" className="text-gray-900 dark:text-white font-semibold">
              知识图谱
            </Typography>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 ml-4">
            <Chip
              value={`${sources.length} 来源`}
              size="sm"
              className="text-xs"
              style={{
                backgroundColor: `${NODE_COLORS.source.node}30`,
                color: NODE_COLORS.source.node,
              }}
            />
            <Chip
              value={`${outputs.length} 产出`}
              size="sm"
              className="text-xs"
              style={{
                backgroundColor: `${NODE_COLORS.output.node}30`,
                color: NODE_COLORS.output.node,
              }}
            />
            <Chip
              value={`${sessions.length} 对话`}
              size="sm"
              className="text-xs"
              style={{
                backgroundColor: `${NODE_COLORS.session.node}30`,
                color: NODE_COLORS.session.node,
              }}
            />
            {contradictionCount > 0 && (
              <Chip
                value={`${contradictionCount} 矛盾`}
                size="sm"
                className="bg-red-500/20 text-red-400 text-xs"
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Visibility toggles */}
          <div className="flex items-center gap-1 mr-4 bg-gray-100/80 rounded-lg p-1 dark:bg-gray-700/50">
            <Tooltip content={visibility.sources ? '隐藏来源' : '显示来源'}>
              <button
                type="button"
                className={`p-1.5 rounded transition-colors ${
                  visibility.sources
                    ? 'bg-blue-500/20 text-blue-500 dark:bg-blue-500/30 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'
                }`}
                onClick={() => toggleVisibility('sources')}
              >
                <DescriptionIcon style={{ fontSize: 16 }} />
              </button>
            </Tooltip>
            <Tooltip content={visibility.outputs ? '隐藏产出' : '显示产出'}>
              <button
                type="button"
                className={`p-1.5 rounded transition-colors ${
                  visibility.outputs
                    ? 'bg-purple-500/20 text-purple-500 dark:bg-purple-500/30 dark:text-purple-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'
                }`}
                onClick={() => toggleVisibility('outputs')}
              >
                <OutputIcon style={{ fontSize: 16 }} />
              </button>
            </Tooltip>
            <Tooltip content={visibility.sessions ? '隐藏对话' : '显示对话'}>
              <button
                type="button"
                className={`p-1.5 rounded transition-colors ${
                  visibility.sessions
                    ? 'bg-green-500/20 text-green-500 dark:bg-green-500/30 dark:text-green-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'
                }`}
                onClick={() => toggleVisibility('sessions')}
              >
                <ChatIcon style={{ fontSize: 16 }} />
              </button>
            </Tooltip>
          </div>

          <Tooltip content="重置布局">
            <IconButton
              variant="text"
              size="sm"
              onClick={handleResetPositions}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
            >
              <ResetLayoutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip content="刷新分析">
            <IconButton
              variant="text"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading || !isConnected}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
            >
              <RefreshIcon className={isLoading ? 'animate-spin' : ''} />
            </IconButton>
          </Tooltip>
          <Tooltip content="关闭">
            <IconButton
              variant="text"
              size="sm"
              onClick={onClose}
              aria-label="关闭知识图谱"
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* Graph Area */}
      <div className="flex-1 relative">
        {totalNodes === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <HubIcon className="h-16 w-16 text-gray-400 dark:text-gray-600 mb-4" />
            <Typography variant="h6" className="text-gray-600 dark:text-gray-400 mb-2">
              暂无内容
            </Typography>
            <Typography variant="small" className="text-gray-600 dark:text-gray-500">
              添加来源、创建产出或开始对话后可查看知识图谱
            </Typography>
          </div>
        ) : isLoading && !analysis ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Spinner className="h-10 w-10 text-blue-400 mb-4" />
            <Typography variant="small" className="text-gray-500 dark:text-gray-400">
              正在分析知识关联...
            </Typography>
          </div>
        ) : error && !analysis ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <WarningIcon className="h-12 w-12 text-red-400 mb-3" />
            <Typography variant="small" className="text-red-400 mb-4">
              {error}
            </Typography>
            <Button
              variant="outlined"
              size="sm"
              onClick={onRefresh}
              disabled={!isConnected}
              className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              重试
            </Button>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color={isDarkTheme ? '#374151' : '#cbd5e1'} gap={20} size={1} />
            <Controls
              showZoom={true}
              showFitView={true}
              showInteractive={false}
              className={
                isDarkTheme
                  ? '!bg-gray-800 !border-gray-700 !shadow-lg [&_button]:!bg-gray-700 [&_button]:!border-gray-600 [&_button]:!text-gray-300 [&_button:hover]:!bg-gray-600'
                  : '!bg-white !border-gray-200 !shadow-lg [&_button]:!bg-white [&_button]:!border-gray-200 [&_button]:!text-gray-600 [&_button:hover]:!bg-gray-100'
              }
            />
            <MiniMap
              nodeColor={(node) => {
                const data = node.data as KnowledgeNodeData;
                if (data.hasContradiction) return '#F87171';
                return NODE_COLORS[data.nodeType]?.node || '#6B7280';
              }}
              maskColor={isDarkTheme ? 'rgba(0,0,0,0.8)' : 'rgba(148, 163, 184, 0.35)'}
              className={
                isDarkTheme ? '!bg-gray-800 !border-gray-700' : '!bg-white !border-gray-200'
              }
            />

            {/* Legend Panel */}
            <Panel position="bottom-left" className="!m-4">
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 border border-gray-200 dark:border-gray-700 space-y-2">
                <Typography
                  variant="small"
                  className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-2"
                >
                  图例
                </Typography>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: NODE_COLORS.source.node }}
                  />
                  <span className="text-gray-700 dark:text-gray-300 text-xs">来源</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: NODE_COLORS.output.node }}
                  />
                  <span className="text-gray-700 dark:text-gray-300 text-xs">产出</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: NODE_COLORS.session.node }}
                  />
                  <span className="text-gray-700 dark:text-gray-300 text-xs">对话</span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
                  <div className="w-8 h-0.5 bg-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300 text-xs">语义关联</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-0.5 bg-red-400"
                    style={{ animation: 'pulse 1s infinite' }}
                  />
                  <span className="text-gray-700 dark:text-gray-300 text-xs">潜在矛盾</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-0.5 border-t-2 border-dashed"
                    style={{ borderColor: NODE_COLORS.output.node }}
                  />
                  <span className="text-gray-700 dark:text-gray-300 text-xs">引用关系</span>
                </div>
              </div>
            </Panel>

            {/* Tips Panel */}
            <Panel position="top-left" className="!m-4">
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
                <Typography variant="small" className="text-gray-500 dark:text-gray-400 text-xs">
                  💡 拖拽节点 · 滚轮缩放 · 点击选中节点 · 顶部切换显示类型
                </Typography>
              </div>
            </Panel>

            {/* Detail Panel */}
            {selectedItem && (
              <Panel position="top-right" className="!m-4 !mr-6">
                <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-600 shadow-xl w-72 overflow-hidden">
                  {/* Detail Header */}
                  <div
                    className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
                    style={{ backgroundColor: `${NODE_COLORS[selectedItem.type].node}20` }}
                  >
                    <div className="flex items-center gap-2">
                      {selectedItem.type === 'source' && (
                        <DescriptionIcon style={{ fontSize: 18, color: NODE_COLORS.source.node }} />
                      )}
                      {selectedItem.type === 'output' && (
                        <OutputIcon style={{ fontSize: 18, color: NODE_COLORS.output.node }} />
                      )}
                      {selectedItem.type === 'session' && (
                        <ChatIcon style={{ fontSize: 18, color: NODE_COLORS.session.node }} />
                      )}
                      <Typography
                        variant="small"
                        className="font-semibold text-gray-900 dark:text-white text-sm"
                      >
                        {NODE_COLORS[selectedItem.type].label}详情
                      </Typography>
                    </div>
                    <IconButton
                      variant="text"
                      size="sm"
                      onClick={() => {
                        setSelectedId(null);
                        setSelectedItem(null);
                      }}
                      className="w-6 h-6 min-w-0 p-0 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700"
                    >
                      <CloseIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  </div>

                  {/* Detail Content */}
                  <div className="p-4 space-y-3">
                    {selectedItem.type === 'source' && (
                      <>
                        <div>
                          <Typography
                            variant="small"
                            className="text-gray-500 dark:text-gray-400 text-xs mb-1"
                          >
                            标题
                          </Typography>
                          <Typography
                            variant="small"
                            className="text-gray-900 dark:text-white font-medium"
                          >
                            {selectedItem.data.title}
                          </Typography>
                        </div>
                        <div className="flex gap-4">
                          <div>
                            <Typography
                              variant="small"
                              className="text-gray-500 dark:text-gray-400 text-xs mb-1"
                            >
                              类型
                            </Typography>
                            <Chip
                              value={selectedItem.data.type}
                              size="sm"
                              className="bg-gray-200 text-gray-700 text-xs dark:bg-gray-700 dark:text-gray-200"
                            />
                          </div>
                          <div>
                            <Typography
                              variant="small"
                              className="text-gray-500 dark:text-gray-400 text-xs mb-1"
                            >
                              片段
                            </Typography>
                            <Typography variant="small" className="text-gray-900 dark:text-white">
                              {selectedItem.data.chunks}
                            </Typography>
                          </div>
                        </div>
                      </>
                    )}
                    {selectedItem.type === 'output' && (
                      <>
                        <div>
                          <Typography
                            variant="small"
                            className="text-gray-500 dark:text-gray-400 text-xs mb-1"
                          >
                            提示词
                          </Typography>
                          <Typography
                            variant="small"
                            className="text-gray-900 dark:text-white font-medium line-clamp-3"
                          >
                            {selectedItem.data.prompt}
                          </Typography>
                        </div>
                        <div className="flex gap-4">
                          <div>
                            <Typography
                              variant="small"
                              className="text-gray-500 dark:text-gray-400 text-xs mb-1"
                            >
                              类型
                            </Typography>
                            <Chip
                              value={selectedItem.data.type}
                              size="sm"
                              className="bg-purple-100 text-purple-700 text-xs dark:bg-purple-500/30 dark:text-purple-200"
                            />
                          </div>
                          <div>
                            <Typography
                              variant="small"
                              className="text-gray-500 dark:text-gray-400 text-xs mb-1"
                            >
                              引用
                            </Typography>
                            <Typography variant="small" className="text-gray-900 dark:text-white">
                              {selectedItem.data.chunkIds?.length || 0} 片段
                            </Typography>
                          </div>
                        </div>
                      </>
                    )}
                    {selectedItem.type === 'session' && (
                      <>
                        <div>
                          <Typography
                            variant="small"
                            className="text-gray-500 dark:text-gray-400 text-xs mb-1"
                          >
                            标题
                          </Typography>
                          <Typography
                            variant="small"
                            className="text-gray-900 dark:text-white font-medium"
                          >
                            {selectedItem.data.title || '未命名会话'}
                          </Typography>
                        </div>
                        <div>
                          <Typography
                            variant="small"
                            className="text-gray-500 dark:text-gray-400 text-xs mb-1"
                          >
                            创建时间
                          </Typography>
                          <Typography
                            variant="small"
                            className="text-gray-600 dark:text-gray-300 text-xs"
                          >
                            {selectedItem.data.createdAt}
                          </Typography>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Detail Actions */}
                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <Button
                      variant="filled"
                      size="sm"
                      onClick={handleOpenDetail}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 normal-case text-sm"
                    >
                      <OpenInNewIcon style={{ fontSize: 16 }} />
                      打开详情
                    </Button>
                  </div>
                </div>
              </Panel>
            )}
          </ReactFlow>
        )}
      </div>
    </div>
  );
}

export default memo(KnowledgeGraphView);
