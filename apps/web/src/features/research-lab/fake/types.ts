import type { ResearchConclusionStatus, ResearchEdgeKind } from '@crystalith/shared';

/**
 * MOCK domain types for Research Lab.
 * Prefer shared `Research*` schemas (`@crystalith/shared`) when fields already exist
 * (conclusionStatus, EdgeKind). Lab-only: phase playback labels, layout prefs, revisions.
 * Real graph nodes currently lack `role`; Lab uses question|research|conclusion for UX.
 */

/** Behavior-framework phases (PRD §二) + confirm / terminal. */
export type LabPhase =
  | 'idle'
  | 'decompose'
  | 'explore'
  | 'evaluate'
  | 'integrate'
  | 'awaiting_confirm'
  | 'completed'
  | 'failed';

export const LAB_PHASES: LabPhase[] = [
  'idle',
  'decompose',
  'explore',
  'evaluate',
  'integrate',
  'awaiting_confirm',
  'completed',
  'failed',
];

export const LAB_PHASE_LABELS: Record<LabPhase, string> = {
  idle: '待命',
  decompose: '意图拆解',
  explore: '多源探索',
  evaluate: '事实验证',
  integrate: '关系整合',
  awaiting_confirm: '等待确认',
  completed: '已完成',
  failed: '失败',
};

export type LabViewMode = 'graph';

/** Flowchart preferred axis. */
export type LabLayoutDirection = 'TB' | 'LR';

/**
 * React Flow built-in edge path styles (see xyflow edge `type` presets).
 * Custom `labAction` edges reuse the matching get*Path helpers.
 */
export type LabEdgePathPreset = 'smoothstep' | 'bezier' | 'step' | 'straight' | 'simplebezier';

export const LAB_EDGE_PATH_PRESETS: readonly {
  id: LabEdgePathPreset;
  label: string;
  title: string;
}[] = [
  { id: 'smoothstep', label: '圆角', title: 'smoothstep · 圆角折线（当前默认）' },
  { id: 'bezier', label: '曲线', title: 'default/bezier · 三次贝塞尔' },
  { id: 'step', label: '直角', title: 'step · 直角折线' },
  { id: 'straight', label: '直线', title: 'straight · 直线' },
  { id: 'simplebezier', label: '简曲', title: 'simplebezier · 简单贝塞尔' },
] as const;

/** ELK layout algorithm presets for demo / product preference. */
export type LabLayoutAlgorithm = 'layered' | 'mrtree' | 'force';

export const LAB_LAYOUT_ALGORITHMS: readonly {
  id: LabLayoutAlgorithm;
  label: string;
  title: string;
}[] = [
  { id: 'layered', label: '分层', title: 'elk.layered · DAG 分层（默认）' },
  { id: 'mrtree', label: '树形', title: 'elk.mrtree · 多根树' },
  { id: 'force', label: '力导', title: 'elk.force · 力导向' },
] as const;

/** v1 single-sink DAG: question → research* → one conclusion. */
export type LabNodeRole = 'question' | 'research' | 'conclusion';

export interface LabGraphMutations {
  /** Prune roots: branch (root + research descendants) fades; topology & merges kept. */
  prunedNodeIds: string[];
  extraNodes: LabNode[];
  extraEdges: LabEdge[];
  /** User edits overlaid on nodes (title / query / summary / finding). */
  nodeEdits: Record<string, Partial<LabNode>>;
  activityNotes: string[];
}

export interface LabCitation {
  id: string;
  title: string;
  url: string;
  snippet: string;
  kind: 'web' | 'docs' | 'paper' | 'github' | 'pdf' | 'community' | 'upload';
  /** Mark as outdated so users can practice fact-checking (PRD journey). */
  stale?: boolean;
  /**
   * Where this ref comes from:
   * - research: retrieved during deep research
   * - notebook: workspace 三栏「来源」中的项目资料（fake / future wire）
   */
  origin?: 'research' | 'notebook';
  /** When origin=notebook, optional mirror of workspace SourceItem.id */
  notebookSourceId?: number;
}

export interface LabNode {
  id: string;
  title: string;
  role?: LabNodeRole;
  query?: string;
  summary?: string;
  /**
   * Research finding text (sub-topic), or the single final answer on `conclusion`.
   * Intermediate research nodes should not present as competing final answers.
   */
  conclusion?: string;
  conclusionStatus: ResearchConclusionStatus;
  phase?: 'idle' | 'retrieving' | 'synthesizing';
  citationIds: string[];
  /**
   * Question-node only: when true, playback pauses at awaiting_confirm for user choice.
   * When false, run through without asking (user can still Pause anytime).
   */
  askOnInterrupt?: boolean;
}

export interface LabEdge {
  id: string;
  source: string;
  target: string;
  kind: ResearchEdgeKind;
  labelNote?: string;
}

export interface LabMetrics {
  tokensUsed: number;
  sourcesRetrieved: number;
  pendingNodes: number;
  elapsedSec: number;
}

export interface LabPhaseSnapshot {
  visibleNodeIds: string[];
  nodeOverrides?: Partial<Record<string, Partial<LabNode>>>;
  metrics: LabMetrics;
  activityLog?: string[];
}

export interface LabScenario {
  id: string;
  label: string;
  shortLabel: string;
  topic: string;
  /** Hard constraints + soft expectations shown in the input strip. */
  constraintsNote: string;
  nodes: LabNode[];
  edges: LabEdge[];
  citations: Record<string, LabCitation>;
  reportMarkdown: string;
  phaseSnapshots: Partial<Record<LabPhase, LabPhaseSnapshot>>;
}

export interface LabDerivedState {
  nodes: LabNode[];
  edges: LabEdge[];
  metrics: LabMetrics;
  activityLog: string[];
  reportVisible: boolean;
  rootTitle: string;
  /** Exactly one conclusion node id when present (v1). */
  conclusionNodeId: string | null;
}
