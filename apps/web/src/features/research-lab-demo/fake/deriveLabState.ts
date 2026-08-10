import type { ResearchConclusionStatus } from '@crystalith/shared';

import { collectPruneClosure } from '../../research-lab/model/pruneClosure';
import type {
  LabDerivedState,
  LabEdge,
  LabGraphMutations,
  LabMetrics,
  LabNode,
  LabPhase,
  LabScenario,
} from '../../research-lab/model/types';

const DEFAULT_METRICS: LabMetrics = {
  tokensUsed: 0,
  sourcesRetrieved: 0,
  pendingNodes: 0,
  elapsedSec: 0,
};

export const EMPTY_MUTATIONS: LabGraphMutations = {
  prunedNodeIds: [],
  extraNodes: [],
  extraEdges: [],
  nodeEdits: {},
  activityNotes: [],
};

const FORK_PLACEHOLDER = '待探索的替代发现。';

/** Appended to conclusion body when pruned research still merges into the sink. */
export const FAILED_MERGE_NOTE_MARKER = '〔部分汇入失败〕';

function isMergeIntoConclusion(
  edge: LabEdge,
  conclusionId: string | null,
  byId: Map<string, LabNode>,
): boolean {
  if (edge.kind === 'merge') return true;
  if (conclusionId && edge.target === conclusionId) return true;
  return byId.get(edge.target)?.role === 'conclusion';
}

/** Research titles that are pruned but still have a merge edge into the conclusion. */
export function listFailedMergeTitles(
  nodes: LabNode[],
  edges: LabEdge[],
  conclusionId: string | null,
): string[] {
  if (!conclusionId) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const titles: string[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (!isMergeIntoConclusion(e, conclusionId, byId)) continue;
    if (e.target !== conclusionId && byId.get(e.target)?.role !== 'conclusion') continue;
    const src = byId.get(e.source);
    if (!src || src.role !== 'research' || src.conclusionStatus !== 'pruned') continue;
    if (seen.has(src.id)) continue;
    seen.add(src.id);
    titles.push(src.title);
  }
  return titles;
}

export function stripFailedMergeNote(text: string | undefined): string {
  if (!text) return '';
  const idx = text.indexOf(`\n\n${FAILED_MERGE_NOTE_MARKER}`);
  if (idx >= 0) return text.slice(0, idx).trimEnd();
  if (text.startsWith(FAILED_MERGE_NOTE_MARKER)) {
    const nl = text.indexOf('\n');
    return nl >= 0 ? text.slice(nl + 1).trim() : '';
  }
  return text;
}

/** Keep single-sink topology readable: note which merges are failed contributions. */
export function annotateConclusionFailedMerges(
  nodes: LabNode[],
  edges: LabEdge[],
  conclusionId: string | null,
): LabNode[] {
  const titles = listFailedMergeTitles(nodes, edges, conclusionId);
  return nodes.map((n) => {
    if (n.role !== 'conclusion' && n.id !== conclusionId) return n;
    const base = stripFailedMergeNote(n.conclusion ?? '');
    if (titles.length === 0) {
      return base === (n.conclusion ?? '') ? n : { ...n, conclusion: base || undefined };
    }
    const note = `\n\n${FAILED_MERGE_NOTE_MARKER}${titles.join('、')}：支路已剪枝，汇入边保留但不参与有效结论。`;
    return { ...n, conclusion: `${base || '综合结论待完善。'}${note}` };
  });
}

/**
 * Fake playback for user-forked nodes (not in scenario phaseSnapshots).
 * Mirrors backend: fork stays in graph, then progresses with run phase / reshape.
 */
export function synthesizeForkNodeProgress(
  node: LabNode,
  phase: LabPhase,
  citePool: string[],
): LabNode {
  if (node.role === 'question' || node.role === 'conclusion') return node;
  if (node.conclusionStatus === 'pruned') return node;

  const cites = node.citationIds.length > 0 ? node.citationIds : citePool.slice(0, 2);

  if (phase === 'idle' || phase === 'decompose') {
    return { ...node, phase: 'idle' };
  }

  if (phase === 'explore') {
    return {
      ...node,
      phase: 'retrieving',
      conclusionStatus: 'pending',
      citationIds: cites.slice(0, 1),
    };
  }

  if (phase === 'failed') {
    return {
      ...node,
      phase: 'idle',
      conclusionStatus: 'missing',
      citationIds: cites,
      conclusion:
        !node.conclusion || node.conclusion === FORK_PLACEHOLDER
          ? `对照支路「${node.title}」探索失败（Fake）。`
          : node.conclusion,
    };
  }

  // evaluate | integrate | awaiting_confirm | completed — settle like a researched branch
  const settledStatus =
    node.conclusionStatus === 'pending' ? ('partial' as const) : node.conclusionStatus;
  const q = node.query?.trim();
  const finding =
    !node.conclusion ||
    node.conclusion === FORK_PLACEHOLDER ||
    node.conclusion.startsWith('待探索：')
      ? q
        ? `对照发现：按「${q}」检索后，与主支路在兼容性/成本上出现可交叉验证的差异点；建议在整合阶段并入结论脚注。（Fake · fork reshape）`
        : `对照发现：「${node.title}」补充了主路径未覆盖的角度；建议交叉验证后更新综合结论。（Fake · fork reshape）`
      : node.conclusion;
  return {
    ...node,
    phase: 'idle',
    conclusionStatus: settledStatus,
    citationIds: cites,
    conclusion: finding,
    summary: node.summary ?? `分叉支路 · ${STATUS_HINT[settledStatus]}`,
  };
}

const STATUS_HINT: Record<string, string> = {
  clear: '明确',
  partial: '待完善',
  missing: '无法结论',
  pending: '处理中',
  pruned: '已剪枝',
};

export function deriveLabState(
  scenario: LabScenario,
  phase: LabPhase,
  opts?: {
    forceStatus?: ResearchConclusionStatus | null;
    metricsOverride?: Partial<LabMetrics> | null;
    mutations?: LabGraphMutations | null;
  },
): LabDerivedState {
  const snap = scenario.phaseSnapshots[phase] ?? scenario.phaseSnapshots.completed;
  const visible = new Set(snap?.visibleNodeIds ?? scenario.nodes.map((n) => n.id));
  const overrides = snap?.nodeOverrides ?? {};
  const mutations = opts?.mutations ?? EMPTY_MUTATIONS;

  const byId = new Map<string, LabNode>();
  for (const n of scenario.nodes) {
    if (!visible.has(n.id)) continue;
    const edit = mutations.nodeEdits[n.id];
    byId.set(n.id, {
      ...n,
      ...overrides[n.id],
      ...edit,
      id: n.id,
      title: edit?.title ?? overrides[n.id]?.title ?? n.title,
      role: edit?.role ?? overrides[n.id]?.role ?? n.role,
    });
  }
  const citePool = Object.keys(scenario.citations);
  for (const n of mutations.extraNodes) {
    const edit = mutations.nodeEdits[n.id];
    const merged = edit ? { ...n, ...edit, id: n.id } : n;
    byId.set(n.id, synthesizeForkNodeProgress(merged, phase, citePool));
  }

  const allEdges: LabEdge[] = [
    ...scenario.edges.filter((e) => byId.has(e.source) && byId.has(e.target)),
    ...mutations.extraEdges.filter((e) => byId.has(e.source) && byId.has(e.target)),
  ];

  // 1B fade + B exclusive-parent cascade; keep topology & merges (2A).
  const prunedIds = new Set<string>();
  const prunedRoots = new Set(mutations.prunedNodeIds.filter((id) => byId.has(id)));
  const nodeList = [...byId.values()];
  for (const root of prunedRoots) {
    for (const id of collectPruneClosure(root, nodeList, allEdges)) {
      prunedIds.add(id);
    }
  }

  const finalNodes: LabNode[] = [...byId.values()].map((n) => {
    if (prunedIds.has(n.id)) {
      return { ...n, conclusionStatus: 'pruned' as const, phase: 'idle' as const };
    }
    if (opts?.forceStatus && n.role !== 'conclusion' && n.role !== 'question') {
      return { ...n, conclusionStatus: opts.forceStatus };
    }
    return n;
  });

  const nodeIds = new Set(finalNodes.map((n) => n.id));
  const conclusionId =
    finalNodes.find((n) => n.role === 'conclusion')?.id ??
    (nodeIds.has('conclusion') ? 'conclusion' : null);

  // Keep full single-sink topology, including failed merges into conclusion.
  const edges: LabEdge[] = allEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  const nodes = annotateConclusionFailedMerges(finalNodes, edges, conclusionId);

  const metrics: LabMetrics = {
    ...DEFAULT_METRICS,
    ...snap?.metrics,
    ...opts?.metricsOverride,
  };

  const question = nodes.find((n) => n.role === 'question' || n.id === 'root');

  return {
    nodes,
    edges,
    metrics,
    activityLog: [...(snap?.activityLog ?? []), ...mutations.activityNotes],
    reportVisible: phase === 'completed' || phase === 'integrate' || phase === 'awaiting_confirm',
    rootTitle: question?.title ?? scenario.topic.slice(0, 24),
    conclusionNodeId: conclusionId,
  };
}

export const PLAYBACK_ORDER: LabPhase[] = [
  'idle',
  'decompose',
  'explore',
  'evaluate',
  'integrate',
  'awaiting_confirm',
  'completed',
];

/** Advance fake playback one step. `askOnInterrupt` gates the confirm pause. */
export function advanceLabPlayback(
  phase: LabPhase,
  askOnInterrupt: boolean,
): { phase: LabPhase; playing: boolean } {
  const idx = PLAYBACK_ORDER.indexOf(phase);
  if (idx < 0 || idx >= PLAYBACK_ORDER.length - 1) {
    return { phase: phase === 'failed' ? phase : 'completed', playing: false };
  }
  const next = PLAYBACK_ORDER[idx + 1];
  if (next === 'awaiting_confirm') {
    if (!askOnInterrupt) return { phase: 'completed', playing: false };
    return { phase: 'awaiting_confirm', playing: false };
  }
  return { phase: next, playing: true };
}
