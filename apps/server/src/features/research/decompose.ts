/**
 * Topic auto-decompose (c93 / r326): structured plan → single-sink DAG edges.
 * Pure graph helpers are unit-tested; LLM call is optional and mockable.
 */
import type {
  ResearchDecomposePlan,
  ResearchDepth,
  ResearchEdge,
  ResearchNode,
} from '@crystalith/shared';
import { ResearchDecomposePlanSchema } from '@crystalith/shared';
import { generateObject } from 'ai';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { getResearchDecomposeModelConfig } from '../../shared/config.ts';

export type ResearchGraphJson = { nodes: ResearchNode[]; edges: ResearchEdge[] };

/** Soft caps for research leaf count by depth (design §3); still clamped by maxNodes. */
export function suggestedMaxResearchLeaves(depth: ResearchDepth): number {
  switch (depth) {
    case 'shallow':
      return 4;
    case 'medium':
      return 8;
    case 'deep':
      return 16;
    default:
      return 8;
  }
}

export function clampDecomposePlan(
  plan: ResearchDecomposePlan,
  opts: { maxNodes: number; occupiedNodes: number; depth: ResearchDepth },
): ResearchDecomposePlan {
  const room = Math.max(0, opts.maxNodes - opts.occupiedNodes);
  const soft = suggestedMaxResearchLeaves(opts.depth);
  const limit = Math.min(room, soft);
  if (limit <= 0 || plan.branches.length === 0) {
    return { branches: [] };
  }
  // Prefer decompose over refine; stable order otherwise.
  const ranked = [...plan.branches].sort((a, b) => {
    const ak = a.edgeKind === 'decompose' ? 0 : 1;
    const bk = b.edgeKind === 'decompose' ? 0 : 1;
    if (ak !== bk) return ak - bk;
    return a.title.localeCompare(b.title, 'zh');
  });
  return { branches: ranked.slice(0, limit) };
}

export type ApplyDecomposeResult = {
  graph: ResearchGraphJson;
  addedNodes: ResearchNode[];
  addedEdges: ResearchEdge[];
};

/**
 * Apply a clamped plan onto an existing single-sink graph.
 * Creates research nodes + decompose/refine from question + merge→conclusion.
 */
export function applyDecomposePlanToGraph(
  graph: ResearchGraphJson,
  plan: ResearchDecomposePlan,
  newId: (prefix: string) => string,
): ApplyDecomposeResult {
  const question =
    graph.nodes.find((n) => n.role === 'question') ??
    graph.nodes.find((n) => n.id.startsWith('node_root'));
  const conclusion =
    graph.nodes.find((n) => n.role === 'conclusion') ??
    graph.nodes.find((n) => n.id.startsWith('node_conclusion'));
  if (!question || !conclusion || plan.branches.length === 0) {
    return { graph, addedNodes: [], addedEdges: [] };
  }

  const addedNodes: ResearchNode[] = [];
  const addedEdges: ResearchEdge[] = [];

  for (const branch of plan.branches) {
    const node: ResearchNode = {
      id: newId('node'),
      role: 'research',
      title: branch.title.trim(),
      query: branch.query.trim(),
      conclusionStatus: 'partial',
      phase: 'idle',
      summary: '',
      evidenceIds: [],
    };
    const fromQ: ResearchEdge = {
      id: newId('edge'),
      source: question.id,
      target: node.id,
      kind: branch.edgeKind === 'refine' ? 'refine' : 'decompose',
      labelNote: branch.edgeKind === 'refine' ? '细化' : '拆解',
    };
    const toC: ResearchEdge = {
      id: newId('edge'),
      source: node.id,
      target: conclusion.id,
      kind: 'merge',
      labelNote: '汇入',
    };
    addedNodes.push(node);
    addedEdges.push(fromQ, toC);
  }

  return {
    graph: {
      nodes: [...graph.nodes, ...addedNodes],
      edges: [...graph.edges, ...addedEdges],
    },
    addedNodes,
    addedEdges,
  };
}

export async function planTopicDecomposition(input: {
  topic: string;
  depth: ResearchDepth;
  maxNodes: number;
  occupiedNodes: number;
  abortSignal?: AbortSignal;
}): Promise<ResearchDecomposePlan | null> {
  const modelConfig = getResearchDecomposeModelConfig();
  if (!modelConfig) return null;

  const soft = suggestedMaxResearchLeaves(input.depth);
  const room = Math.max(0, input.maxNodes - input.occupiedNodes);
  const target = Math.min(soft, room);
  if (target <= 0) return { branches: [] };

  try {
    const model = withRetry(await resolveModel(modelConfig));
    const { object } = await generateObject({
      model,
      schema: ResearchDecomposePlanSchema,
      abortSignal: input.abortSignal,
      prompt: [
        '你是深度研究规划器。把研究主题拆成若干并行「研究支路」。',
        `主题：${input.topic}`,
        `深度档：${input.depth}；最多输出 ${target} 条 branches（勿超过）。`,
        '每条 branch 需要 title（短标题）与 query（可检索的查询句）。',
        'edgeKind 默认 decompose（从总问题拆出）；仅当明显是细化子问题时用 refine。',
        '不要输出结论节点；汇入结论由系统自动加 merge 边。',
        '若主题过窄无法拆解，返回空 branches 数组。',
      ].join('\n'),
    });
    const parsed = ResearchDecomposePlanSchema.safeParse(object);
    if (!parsed.success) return null;
    return clampDecomposePlan(parsed.data, {
      maxNodes: input.maxNodes,
      occupiedNodes: input.occupiedNodes,
      depth: input.depth,
    });
  } catch {
    return null;
  }
}
