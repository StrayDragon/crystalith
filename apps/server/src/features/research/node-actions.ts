// Research domain — node actions & prune cascade.
// Extracted from commands.ts (elysia review B1): single-concern modules,
// consumers keep importing from ./commands.ts (facade re-exports).
import type {
  ResearchEdge,
  ResearchForkBody,
  ResearchNode,
  ResearchNodePatchBody,
  ResearchRun,
} from '@crystalith/shared';

import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import {
  CONFIRM_OPTIONS,
  assertLiveMutable,
  broadcast,
  emitGraphPatch,
  emitLog,
  emitStatus,
  getGraph,
  isPruneProtectedNode,
  persistGraph,
  requireRun,
  serializeRun,
  updateRun,
  writeCheckpoint,
} from './research-core.ts';

export function isPruneProtectedNodeId(nodeId: string, nodes: ResearchNode[] = []): boolean {
  const node = nodes.find((n) => n.id === nodeId);
  return isPruneProtectedNode(node, nodeId);
}

/**
 * Prune closure (r316 / update-research-prune-cascade) — keep in sync with
 * Lab `collectPruneClosure` in apps/web/.../research-lab/model/pruneClosure.ts.
 * - never includes protected sink/root nodes (role first, then id prefix)
 * - does not walk `merge` edges (failed merges stay attached)
 * - cascades only when every non-protected inbound parent is already in the
 *   closure or already pruned (shared children with a live parent stay live)
 */
export function collectResearchPruneClosure(
  rootId: string,
  nodes: ResearchNode[],
  edges: ResearchEdge[],
): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (!byId.has(rootId) || isPruneProtectedNodeId(rootId, nodes)) return new Set();

  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  for (const e of edges) {
    if (e.kind === 'merge') continue;
    const outs = children.get(e.source) ?? [];
    outs.push(e.target);
    children.set(e.source, outs);
    const inns = parents.get(e.target) ?? [];
    inns.push(e.source);
    parents.set(e.target, inns);
  }

  const out = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const childId of children.get(id) ?? []) {
      if (out.has(childId)) continue;
      if (isPruneProtectedNodeId(childId, nodes)) continue;
      const blocking = (parents.get(childId) ?? []).some((pid) => {
        if (out.has(pid)) return false;
        if (isPruneProtectedNodeId(pid, nodes)) return false;
        if (byId.get(pid)?.conclusionStatus === 'pruned') return false;
        return true;
      });
      if (blocking) continue;
      out.add(childId);
      stack.push(childId);
    }
  }
  return out;
}

export function pruneNode(notebookId: number, runId: number, nodeId: string): ResearchRun {
  const row = requireRun(notebookId, runId);
  assertLiveMutable(row.status);
  const graph = getGraph(row);
  const target = graph.nodes.find((n) => n.id === nodeId);
  if (!target) {
    throw new AppHttpError(ErrorCode.NOT_FOUND, `Node ${nodeId} not found`);
  }
  if (isPruneProtectedNode(target, nodeId)) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, `Cannot prune protected node ${nodeId}`);
  }
  const toPrune = collectResearchPruneClosure(nodeId, graph.nodes, graph.edges);
  for (const n of graph.nodes) {
    if (toPrune.has(n.id)) {
      n.conclusionStatus = 'pruned';
      n.phase = 'idle';
    }
  }
  persistGraph(runId, graph, {
    checkpoint: writeCheckpoint(row, `prune_${nodeId}`),
  });
  emitGraphPatch(runId, {
    nodes: graph.nodes.filter((n) => toPrune.has(n.id)),
  });
  emitLog(runId, `已剪枝节点 ${nodeId}${toPrune.size > 1 ? `（级联 ${toPrune.size}）` : ''}`);
  return serializeRun(requireRun(notebookId, runId));
}

export function patchNode(
  notebookId: number,
  runId: number,
  nodeId: string,
  body: ResearchNodePatchBody,
): ResearchRun {
  const row = requireRun(notebookId, runId);
  assertLiveMutable(row.status);
  const graph = getGraph(row);
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) {
    throw new AppHttpError(ErrorCode.NOT_FOUND, `Node ${nodeId} not found`);
  }
  if (node.conclusionStatus === 'pruned') {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, `Cannot patch pruned node ${nodeId}`);
  }
  if (isPruneProtectedNode(node, nodeId)) {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      `Cannot patch protected question/conclusion node ${nodeId}`,
    );
  }
  if (body.title !== undefined) node.title = body.title;
  if (body.query !== undefined) node.query = body.query;
  if (body.conclusionStatus !== undefined) node.conclusionStatus = body.conclusionStatus;
  persistGraph(runId, graph, {
    checkpoint: writeCheckpoint(row, `patch_${nodeId}`),
  });
  emitGraphPatch(runId, { nodes: [node] });
  return serializeRun(requireRun(notebookId, runId));
}

export function forkNode(
  notebookId: number,
  runId: number,
  nodeId: string,
  body: ResearchForkBody,
): ResearchRun {
  const row = requireRun(notebookId, runId);
  assertLiveMutable(row.status);
  const graph = getGraph(row);
  if (!graph.nodes.some((n) => n.id === nodeId)) {
    throw new AppHttpError(ErrorCode.NOT_FOUND, `Node ${nodeId} not found`);
  }
  if (graph.nodes.filter((n) => n.conclusionStatus !== 'pruned').length >= row.maxNodes) {
    throw new AppHttpError(ErrorCode.RESEARCH_BUDGET, 'Node budget exhausted');
  }
  // Enter expand_branch confirm (same capability surface as M1)
  emitLog(runId, `fork 请求${body.hint ? `：${body.hint}` : ''}`);
  // Synchronous status flip so caller sees awaiting_confirm immediately
  const current = requireRun(notebookId, runId);
  updateRun(runId, {
    status: 'awaiting_confirm',
    confirmKind: 'expand_branch',
    confirmBranchNodeId: nodeId,
    checkpoint: writeCheckpoint(current, 'before_confirm_expand_branch'),
  });
  emitStatus(runId, 'awaiting_confirm', 'expand_branch');
  broadcast(runId, 'confirm', {
    kind: 'expand_branch',
    branchNodeId: nodeId,
    options: CONFIRM_OPTIONS.expand_branch,
  });
  return serializeRun(requireRun(notebookId, runId));
}
