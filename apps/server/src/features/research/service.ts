/**
 * Deep Research runtime (c76) — ResearchRun SSOT + pragmatic orchestrator.
 *
 * Flow: create → queued → running → (optional awaiting_confirm) → completed.
 * FE Desk/xyflow is c77; this module is HTTP + persistence + SSE only.
 */
import type {
  ResearchConfirmBody,
  ResearchConvertBody,
  ResearchCreateBody,
  ResearchDepth,
  ResearchEdge,
  ResearchEvidence,
  ResearchForkBody,
  ResearchGraphPatch,
  ResearchNode,
  ResearchReport,
  ResearchRun,
  ResearchRunStatus,
} from '@crystalith/shared';
import { RESEARCH_DEPTH_BUDGETS } from '@crystalith/shared';
import { and, count, desc, eq } from 'drizzle-orm';
import { NotFoundError } from 'elysia';

import { searchWeb } from '../../ai/tools/web-search.ts';
import { db } from '../../db/index.ts';
import {
  chunks,
  notebooks,
  outputs,
  researchEvidences,
  researchRuns,
  sources,
  type ResearchCheckpointJson,
  type ResearchGraphJson,
} from '../../db/schema.ts';
import { bumpSourcesEpoch } from '../../rag/cache.ts';
import { ragRegistry } from '../../rag/registry.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { splitTextToChunks } from '../outputs/render.ts';

export type SseEmit = (event: string, data: unknown) => void;

type RunRow = typeof researchRuns.$inferSelect;

/** In-memory subscribers for live SSE (per run). */
const runEmitters = new Map<number, Set<SseEmit>>();

/** Runs currently executing (dedupe schedule). */
const activeLoops = new Set<number>();

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

function emptyGraph(): ResearchGraphJson {
  return { nodes: [], edges: [] };
}

function getGraph(row: RunRow): ResearchGraphJson {
  return row.graph ?? emptyGraph();
}

function writeCheckpoint(row: RunRow, reason?: string): ResearchCheckpointJson {
  const graph = getGraph(row);
  return {
    at: new Date().toISOString(),
    status: row.status,
    searchesUsed: row.searchesUsed,
    nodeCount: graph.nodes.length,
    reason,
  };
}

function broadcast(runId: number, event: string, data: unknown): void {
  const set = runEmitters.get(runId);
  if (!set) return;
  for (const emit of set) {
    try {
      emit(event, data);
    } catch {
      // drop broken subscriber
    }
  }
}

export function subscribeRun(runId: number, emit: SseEmit): () => void {
  let set = runEmitters.get(runId);
  if (!set) {
    set = new Set();
    runEmitters.set(runId, set);
  }
  set.add(emit);
  return () => {
    set!.delete(emit);
    if (set!.size === 0) runEmitters.delete(runId);
  };
}

function serializeRun(row: RunRow): ResearchRun {
  const graph = getGraph(row);
  return {
    id: row.id,
    notebookId: row.notebookId,
    topic: row.topic,
    status: row.status as ResearchRunStatus,
    useNotebookSources: row.useNotebookSources,
    allowWeb: row.allowWeb,
    sourceIds: row.sourceIds ?? null,
    depth: row.depth as ResearchDepth,
    maxSearches: row.maxSearches,
    maxNodes: row.maxNodes,
    searchesUsed: row.searchesUsed,
    nodes: graph.nodes as ResearchNode[],
    edges: graph.edges as ResearchEdge[],
    report: (row.report as ResearchReport | null) ?? null,
    confirmKind: (row.confirmKind as 'budget' | 'expand_branch' | null) ?? null,
    confirmBranchNodeId: row.confirmBranchNodeId ?? null,
    errorMessage: row.errorMessage ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function requireNotebook(notebookId: number): void {
  const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
  if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);
}

function requireRun(notebookId: number, runId: number): RunRow {
  const row = db()
    .select()
    .from(researchRuns)
    .where(and(eq(researchRuns.id, runId), eq(researchRuns.notebookId, notebookId)))
    .get();
  if (!row) throw new NotFoundError(`Research run ${runId} not found`);
  return row;
}

function assertLiveMutable(status: string): void {
  if (status !== 'running' && status !== 'awaiting_confirm') {
    throw new AppHttpError(
      ErrorCode.RESEARCH_INVALID_STATE,
      `Cannot modify graph when status is ${status}`,
    );
  }
}

/** H1′ + L1 validation; returns normalized create fields. */
export function validateCreateBody(body: ResearchCreateBody): {
  topic: string;
  useNotebookSources: boolean;
  allowWeb: boolean;
  sourceIds: number[] | null;
  depth: ResearchDepth;
  maxSearches: number;
  maxNodes: number;
} {
  const topic = body.topic.trim();
  if (!topic) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'topic is required');
  }
  const useNotebookSources = body.useNotebookSources ?? true;
  const allowWeb = body.allowWeb ?? true;
  if (!useNotebookSources && !allowWeb) {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      'useNotebookSources or allowWeb must be true',
    );
  }
  const depth: ResearchDepth = body.depth ?? 'medium';
  const budget = RESEARCH_DEPTH_BUDGETS[depth];
  let sourceIds: number[] | null = null;
  if (useNotebookSources) {
    const ids = body.sourceIds ?? [];
    if (ids.length === 0) {
      throw new AppHttpError(
        ErrorCode.INVALID_REQUEST,
        'sourceIds must not be empty when useNotebookSources is true',
      );
    }
    sourceIds = ids;
  }
  return {
    topic,
    useNotebookSources,
    allowWeb,
    sourceIds,
    depth,
    maxSearches: budget.maxSearches,
    maxNodes: budget.maxNodes,
  };
}

export function createRun(notebookId: number, body: ResearchCreateBody): ResearchRun {
  requireNotebook(notebookId);
  const fields = validateCreateBody(body);
  const row = db()
    .insert(researchRuns)
    .values({
      notebookId,
      topic: fields.topic,
      status: 'queued',
      useNotebookSources: fields.useNotebookSources,
      allowWeb: fields.allowWeb,
      sourceIds: fields.sourceIds,
      depth: fields.depth,
      maxSearches: fields.maxSearches,
      maxNodes: fields.maxNodes,
      searchesUsed: 0,
      graph: emptyGraph(),
      checkpoint: null,
      report: null,
      cancelRequested: false,
    })
    .returning()
    .get();
  scheduleRun(row.id);
  return serializeRun(row);
}

export function listRuns(
  notebookId: number,
  offset: number,
  limit: number,
): { items: ResearchRun[]; total: number; offset: number; limit: number } {
  requireNotebook(notebookId);
  const total =
    db()
      .select({ value: count() })
      .from(researchRuns)
      .where(eq(researchRuns.notebookId, notebookId))
      .get()?.value ?? 0;
  const rows = db()
    .select()
    .from(researchRuns)
    .where(eq(researchRuns.notebookId, notebookId))
    .orderBy(desc(researchRuns.updatedAt))
    .limit(limit)
    .offset(offset)
    .all();
  return { items: rows.map(serializeRun), total, offset, limit };
}

export function getRun(notebookId: number, runId: number): ResearchRun {
  return serializeRun(requireRun(notebookId, runId));
}

function updateRun(runId: number, patch: Partial<typeof researchRuns.$inferInsert>): RunRow {
  const row = db()
    .update(researchRuns)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(researchRuns.id, runId))
    .returning()
    .get();
  if (!row) throw new NotFoundError(`Research run ${runId} not found`);
  return row;
}

function persistGraph(runId: number, graph: ResearchGraphJson, extra?: Partial<RunRow>): RunRow {
  return updateRun(runId, { graph, ...extra });
}

function insertEvidence(
  runId: number,
  notebookId: number,
  evidence: Omit<ResearchEvidence, 'id'> & { id?: string },
): ResearchEvidence {
  const id = evidence.id ?? newId('ev');
  db()
    .insert(researchEvidences)
    .values({
      id,
      runId,
      notebookId,
      kind: evidence.kind,
      title: evidence.title,
      snippet: evidence.snippet ?? null,
      url: evidence.url ?? null,
      sourceId: evidence.sourceId ?? null,
      chunkId: evidence.chunkId ?? null,
      collectedAtNodeId: evidence.collectedAtNodeId ?? null,
    })
    .run();
  return { ...evidence, id };
}

function listEvidences(runId: number): ResearchEvidence[] {
  return db()
    .select()
    .from(researchEvidences)
    .where(eq(researchEvidences.runId, runId))
    .all()
    .map((e) => ({
      id: e.id,
      kind: e.kind as 'web' | 'chunk',
      title: e.title,
      snippet: e.snippet ?? undefined,
      url: e.url ?? undefined,
      sourceId: e.sourceId ?? undefined,
      chunkId: e.chunkId ?? undefined,
      collectedAtNodeId: e.collectedAtNodeId ?? undefined,
    }));
}

function emitGraphPatch(runId: number, patch: ResearchGraphPatch): void {
  broadcast(runId, 'graph_patch', patch);
}

function emitStatus(runId: number, status: ResearchRunStatus, reason?: string): void {
  broadcast(runId, 'status', reason ? { status, reason } : { status });
}

function emitLog(runId: number, message: string): void {
  broadcast(runId, 'log', { message, at: new Date().toISOString() });
}

function isCancelled(runId: number): boolean {
  const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
  return Boolean(row?.cancelRequested) || row?.status === 'cancelled';
}

/** Schedule async execution (microtask). */
export function scheduleRun(runId: number): void {
  if (activeLoops.has(runId)) return;
  queueMicrotask(() => {
    void runLoop(runId);
  });
}

async function runLoop(runId: number): Promise<void> {
  if (activeLoops.has(runId)) return;
  activeLoops.add(runId);
  try {
    let row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
    if (!row) return;
    if (row.status !== 'queued' && row.status !== 'running') return;

    row = updateRun(runId, { status: 'running' });
    emitStatus(runId, 'running');
    emitLog(runId, `开始研究「${row.topic}」`);

    if (isCancelled(runId)) {
      finalizeCancel(runId);
      return;
    }

    const graph = getGraph(row);
    let root = graph.nodes.find((n) => n.id.startsWith('node_root'));
    if (!root) {
      root = {
        id: newId('node_root'),
        title: row.topic,
        query: row.topic,
        conclusionStatus: 'pending',
        phase: 'retrieving',
        evidenceIds: [],
      };
      graph.nodes.push(root);
      row = persistGraph(runId, graph);
      emitGraphPatch(runId, { nodes: [root as ResearchNode] });
    }

    const evidenceIds: string[] = [...(root.evidenceIds ?? [])];

    // Notebook retrieve
    if (row.useNotebookSources && row.sourceIds?.length) {
      try {
        const hits = await ragRegistry.retrieveWith('embed', row.notebookId, row.topic, {
          topK: 5,
          minScore: 0,
          sourceIds: row.sourceIds,
        });
        for (const hit of hits) {
          if (isCancelled(runId)) {
            finalizeCancel(runId);
            return;
          }
          const ev = insertEvidence(runId, row.notebookId, {
            kind: 'chunk',
            title: `来源 ${hit.sourceId} · chunk ${hit.chunkIndex}`,
            snippet: hit.text.slice(0, 500),
            sourceId: hit.sourceId,
            chunkId: String(hit.chunkId),
            collectedAtNodeId: root.id,
          });
          evidenceIds.push(ev.id);
        }
        emitLog(runId, `检索笔记本：${hits.length} 条`);
      } catch (error) {
        emitLog(runId, `笔记本检索失败：${String(error)}`);
      }
    }

    // Web search (reuse searchWeb)
    if (row.allowWeb) {
      if (row.searchesUsed >= row.maxSearches) {
        throw new AppHttpError(ErrorCode.RESEARCH_BUDGET, 'Web search budget exhausted');
      }
      // Approaching budget: pause for M1 before spending the last search slots
      const approaching = row.searchesUsed >= Math.max(1, row.maxSearches - 1);
      if (approaching && row.searchesUsed > 0) {
        await enterConfirm(runId, 'budget');
        return;
      }
      try {
        const results = await searchWeb(row.topic, { maxResults: 5 });
        row = updateRun(runId, { searchesUsed: row.searchesUsed + 1 });
        for (const item of results) {
          const ev = insertEvidence(runId, row.notebookId, {
            kind: 'web',
            title: item.title || item.url,
            snippet: item.snippet,
            url: item.url,
            collectedAtNodeId: root.id,
          });
          evidenceIds.push(ev.id);
        }
        emitLog(runId, `外网检索：${results.length} 条`);
      } catch (error) {
        if (error instanceof AppHttpError) throw error;
        emitLog(runId, `外网检索失败：${String(error)}`);
      }
    }

    if (isCancelled(runId)) {
      finalizeCancel(runId);
      return;
    }

    // Complete root node + checkpoint (CP1)
    root = {
      ...root,
      phase: 'idle',
      conclusionStatus: evidenceIds.length > 0 ? 'partial' : 'missing',
      summary: evidenceIds.length ? `已收集 ${evidenceIds.length} 条证据` : '未收集到证据',
      evidenceIds,
    };
    const idx = graph.nodes.findIndex((n) => n.id === root!.id);
    if (idx >= 0) graph.nodes[idx] = root;
    else graph.nodes.push(root);
    row = persistGraph(runId, graph);
    emitGraphPatch(runId, { nodes: [root as ResearchNode] });
    row = updateRun(runId, { checkpoint: writeCheckpoint(row, 'node_complete') });

    // Pragmatic M1: after first wave with web, pause for budget confirm when
    // we still have remaining search budget (so continue can resume).
    if (row.allowWeb && row.searchesUsed > 0 && row.searchesUsed < row.maxSearches) {
      await enterConfirm(runId, 'budget');
      return;
    }

    await synthesizeAndComplete(runId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof AppHttpError ? error.code : ErrorCode.INTERNAL_ERROR;
    updateRun(runId, { status: 'failed', errorMessage: message });
    broadcast(runId, 'error', { errorCode: code, message });
    emitStatus(runId, 'failed', message);
  } finally {
    activeLoops.delete(runId);
  }
}

async function enterConfirm(
  runId: number,
  kind: 'budget' | 'expand_branch',
  branchNodeId?: string,
): Promise<void> {
  let row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
  if (!row) return;
  row = updateRun(runId, {
    status: 'awaiting_confirm',
    confirmKind: kind,
    confirmBranchNodeId: branchNodeId ?? null,
    checkpoint: writeCheckpoint(row, `before_confirm_${kind}`),
  });
  emitStatus(runId, 'awaiting_confirm', kind);
  broadcast(runId, 'confirm', {
    kind,
    branchNodeId,
    options: kind === 'budget' ? ['continue', 'finish_report'] : ['approve_branch', 'skip_branch'],
  });
}

function finalizeCancel(runId: number): void {
  const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
  if (!row || row.status === 'cancelled') return;
  updateRun(runId, {
    status: 'cancelled',
    checkpoint: writeCheckpoint(row, 'cancel'),
    cancelRequested: true,
  });
  emitStatus(runId, 'cancelled');
  emitLog(runId, '研究已取消');
}

export function cancelRun(notebookId: number, runId: number): ResearchRun {
  const row = requireRun(notebookId, runId);
  if (row.status === 'completed' || row.status === 'failed' || row.status === 'cancelled') {
    throw new AppHttpError(
      ErrorCode.RESEARCH_INVALID_STATE,
      `Cannot cancel run in status ${row.status}`,
    );
  }
  updateRun(runId, {
    cancelRequested: true,
    checkpoint: writeCheckpoint(row, 'cancel_requested'),
  });
  if (row.status === 'awaiting_confirm' || row.status === 'queued') {
    finalizeCancel(runId);
  }
  // running: loop checks cancelRequested
  return serializeRun(requireRun(notebookId, runId));
}

export async function confirmRun(
  notebookId: number,
  runId: number,
  body: ResearchConfirmBody,
): Promise<ResearchRun> {
  const row = requireRun(notebookId, runId);
  if (row.status !== 'awaiting_confirm') {
    throw new AppHttpError(
      ErrorCode.RESEARCH_INVALID_STATE,
      `Cannot confirm when status is ${row.status}`,
    );
  }
  const kind = row.confirmKind ?? 'budget';
  if (kind === 'budget') {
    if (body.action !== 'continue' && body.action !== 'finish_report') {
      throw new AppHttpError(
        ErrorCode.INVALID_REQUEST,
        'budget confirm requires continue or finish_report',
      );
    }
    updateRun(runId, {
      status: 'running',
      confirmKind: null,
      confirmBranchNodeId: null,
    });
    emitStatus(runId, 'running', body.action);
    if (body.action === 'continue') {
      // One more optional search then report (stay under budget)
      const latest = requireRun(notebookId, runId);
      if (latest.allowWeb && latest.searchesUsed < latest.maxSearches) {
        try {
          const results = await searchWeb(latest.topic, { maxResults: 3 });
          updateRun(runId, { searchesUsed: latest.searchesUsed + 1 });
          const graph = getGraph(latest);
          const root = graph.nodes[0];
          for (const item of results) {
            const ev = insertEvidence(runId, notebookId, {
              kind: 'web',
              title: item.title || item.url,
              snippet: item.snippet,
              url: item.url,
              collectedAtNodeId: root?.id,
            });
            if (root) {
              root.evidenceIds = [...(root.evidenceIds ?? []), ev.id];
            }
          }
          if (root) {
            persistGraph(runId, graph);
            emitGraphPatch(runId, { nodes: [root as ResearchNode] });
          }
          emitLog(runId, `继续检索：${results.length} 条`);
        } catch (error) {
          emitLog(runId, `继续检索失败：${String(error)}`);
        }
      }
    }
    await synthesizeAndComplete(runId);
  } else {
    // expand_branch
    if (body.action !== 'approve_branch' && body.action !== 'skip_branch') {
      throw new AppHttpError(
        ErrorCode.INVALID_REQUEST,
        'expand_branch confirm requires approve_branch or skip_branch',
      );
    }
    const branchNodeId = body.branchNodeId ?? row.confirmBranchNodeId;
    if (!branchNodeId) {
      throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'branchNodeId is required');
    }
    updateRun(runId, {
      status: 'running',
      confirmKind: null,
      confirmBranchNodeId: null,
    });
    emitStatus(runId, 'running', body.action);
    if (body.action === 'approve_branch') {
      const latest = requireRun(notebookId, runId);
      const graph = getGraph(latest);
      if (graph.nodes.length >= latest.maxNodes) {
        throw new AppHttpError(ErrorCode.RESEARCH_BUDGET, 'Node budget exhausted');
      }
      const child: ResearchNode = {
        id: newId('node'),
        title: `扩展：${branchNodeId}`,
        query: latest.topic,
        conclusionStatus: 'partial',
        phase: 'idle',
        summary: '支路已批准（v1 stub）',
        evidenceIds: [],
      };
      const edge: ResearchEdge = {
        id: newId('edge'),
        source: branchNodeId,
        target: child.id,
        kind: 'expand',
      };
      graph.nodes.push(child);
      graph.edges.push(edge);
      persistGraph(runId, graph);
      emitGraphPatch(runId, { nodes: [child], edges: [edge] });
    }
    await synthesizeAndComplete(runId);
  }
  return serializeRun(requireRun(notebookId, runId));
}

async function synthesizeAndComplete(runId: number): Promise<void> {
  if (isCancelled(runId)) {
    finalizeCancel(runId);
    return;
  }
  const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
  if (!row) return;
  const report = synthesizeReport(row);
  updateRun(runId, {
    status: 'completed',
    report: report as unknown as typeof row.report,
    confirmKind: null,
    confirmBranchNodeId: null,
    checkpoint: writeCheckpoint({ ...row, status: 'completed' }, 'report'),
  });
  emitLog(runId, '报告已生成');
  broadcast(runId, 'report_ready', { runId });
  emitStatus(runId, 'completed');
}

/** R6a structured report from evidences + topic. */
export function synthesizeReport(row: RunRow): ResearchReport {
  const evidences = listEvidences(row.id);
  const citations: ResearchReport['citations'] = {};
  const citeIds: string[] = [];
  for (const ev of evidences) {
    const cid = `c${citeIds.length + 1}`;
    citeIds.push(cid);
    citations[cid] = {
      sourceName: ev.title,
      snippet: ev.snippet ?? ev.title,
      url: ev.url,
      sourceId: ev.sourceId,
      chunkId: ev.chunkId,
    };
  }
  const summaryLines =
    evidences.length > 0
      ? evidences.map((e, i) => `- ${e.title}${citeIds[i] ? ` [${citeIds[i]}]` : ''}`).join('\n')
      : '- （暂无证据）';

  return {
    title: `研究报告：${row.topic}`,
    sections: [
      {
        id: 'overview',
        heading: '概述',
        blocks: [
          {
            type: 'paragraph',
            text: `围绕「${row.topic}」的深度研究结果如下。共收集 ${evidences.length} 条证据。`,
            citeIds: citeIds.slice(0, 3),
          },
        ],
      },
      {
        id: 'evidence',
        heading: '证据摘要',
        blocks: [
          {
            type: 'bullets',
            items: evidences.length
              ? evidences.map((e, i) => ({
                  text: `${e.title}${e.snippet ? ` — ${e.snippet.slice(0, 120)}` : ''}`,
                  citeIds: citeIds[i] ? [citeIds[i]] : [],
                }))
              : [{ text: '未收集到可用证据', citeIds: [] }],
          },
          {
            type: 'paragraph',
            text: `证据列表：\n${summaryLines}`,
            citeIds,
          },
        ],
      },
    ],
    citations,
  };
}

function isPruneProtectedNodeId(nodeId: string): boolean {
  // c76 graph has no role field yet — protect root (and future conclusion ids).
  return nodeId.startsWith('node_root') || nodeId.startsWith('node_conclusion');
}

/**
 * Prune closure (r316 / update-research-prune-cascade) — keep in sync with
 * Lab `collectPruneClosure` in apps/web/.../fake/deriveLabState.ts.
 * - never includes protected sink/root nodes
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
  if (!byId.has(rootId) || isPruneProtectedNodeId(rootId)) return new Set();

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
      if (isPruneProtectedNodeId(childId)) continue;
      const blocking = (parents.get(childId) ?? []).some((pid) => {
        if (out.has(pid)) return false;
        if (isPruneProtectedNodeId(pid)) return false;
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
  if (!graph.nodes.some((n) => n.id === nodeId)) {
    throw new AppHttpError(ErrorCode.NOT_FOUND, `Node ${nodeId} not found`);
  }
  if (isPruneProtectedNodeId(nodeId)) {
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
    nodes: graph.nodes.filter((n) => toPrune.has(n.id)) as ResearchNode[],
  });
  emitLog(runId, `已剪枝节点 ${nodeId}${toPrune.size > 1 ? `（级联 ${toPrune.size}）` : ''}`);
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
    options: ['approve_branch', 'skip_branch'],
  });
  return serializeRun(requireRun(notebookId, runId));
}

function reportToMarkdown(report: ResearchReport): string {
  const citeOrder: string[] = [];
  const noteCite = (ids: string[]) => {
    const marks: string[] = [];
    for (const id of ids) {
      let idx = citeOrder.indexOf(id);
      if (idx < 0) {
        citeOrder.push(id);
        idx = citeOrder.length - 1;
      }
      marks.push(`[^${idx + 1}]`);
    }
    return marks.join('');
  };

  const lines: string[] = [`# ${report.title}`, ''];
  for (const section of report.sections) {
    lines.push(`## ${section.heading}`, '');
    for (const block of section.blocks) {
      if (block.type === 'paragraph') {
        lines.push(`${block.text}${noteCite(block.citeIds)}`, '');
      } else {
        for (const item of block.items) {
          lines.push(`- ${item.text}${noteCite(item.citeIds)}`);
        }
        lines.push('');
      }
    }
  }
  if (citeOrder.length) {
    lines.push('---', '', '## 参考文献', '');
    citeOrder.forEach((id, i) => {
      const c = report.citations[id];
      if (!c) return;
      const url = c.url ? ` ${c.url}` : '';
      lines.push(`[^${i + 1}]: ${c.sourceName} — ${c.snippet}${url}`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

function resolveArtifactMarkdown(
  notebookId: number,
  runId: number,
  artifact: ResearchConvertBody['artifact'],
): { title: string; markdown: string } {
  const row = requireRun(notebookId, runId);
  if (artifact.kind === 'report') {
    if (!row.report) {
      throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Run has no report yet');
    }
    const report = row.report as unknown as ResearchReport;
    return { title: report.title, markdown: reportToMarkdown(report) };
  }
  if (artifact.kind === 'node') {
    const node = getGraph(row).nodes.find((n) => n.id === artifact.nodeId);
    if (!node) throw new AppHttpError(ErrorCode.NOT_FOUND, `Node ${artifact.nodeId} not found`);
    const md = `# ${node.title}\n\n${node.summary ?? ''}\n`;
    return { title: node.title, markdown: md };
  }
  const ev = listEvidences(runId).find((e) => e.id === artifact.evidenceId);
  if (!ev) {
    throw new AppHttpError(ErrorCode.NOT_FOUND, `Evidence ${artifact.evidenceId} not found`);
  }
  const md = `# ${ev.title}\n\n${ev.snippet ?? ''}${ev.url ? `\n\n${ev.url}` : ''}\n`;
  return { title: ev.title, markdown: md };
}

export function convertToNote(
  notebookId: number,
  runId: number,
  body: ResearchConvertBody,
): { outputId: number; type: 'PARAGRAPH' } {
  const { title, markdown } = resolveArtifactMarkdown(notebookId, runId, body.artifact);
  const output = db()
    .insert(outputs)
    .values({
      notebookId,
      type: 'PARAGRAPH',
      prompt: title,
      chunkIds: [],
      content: { title, text: markdown },
    })
    .returning()
    .get();
  return { outputId: output.id, type: 'PARAGRAPH' };
}

export async function convertToSource(
  notebookId: number,
  runId: number,
  body: ResearchConvertBody,
): Promise<{ sourceId: number; filename: string; chunkCount: number }> {
  const { title, markdown } = resolveArtifactMarkdown(notebookId, runId, body.artifact);
  const chunkTexts = splitTextToChunks(markdown, 500, 50);
  const filename = `research-${runId}-${body.artifact.kind}.md`;

  const sourceRow = db()
    .insert(sources)
    .values({
      notebookId,
      filename,
      mimeType: 'text/markdown',
      parserType: 'text',
      status: 'processing',
      metadata: {
        type: 'research_conversion',
        source: 'research_conversion',
        runId,
        artifact: body.artifact,
        title,
      },
    })
    .returning()
    .get();

  let offset = 0;
  for (let i = 0; i < chunkTexts.length; i++) {
    const text = chunkTexts[i]!;
    db()
      .insert(chunks)
      .values({
        sourceId: sourceRow.id,
        chunkIndex: i,
        text,
        startOffset: offset,
        endOffset: offset + text.length,
      })
      .run();
    offset += text.length + 2;
  }

  try {
    const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
    const strategy = new EmbedStrategy();
    await strategy.indexSource(sourceRow.id, sourceRow.notebookId);
    db().update(sources).set({ status: 'ready' }).where(eq(sources.id, sourceRow.id)).run();
    bumpSourcesEpoch(sourceRow.notebookId);
  } catch {
    db().update(sources).set({ status: 'failed' }).where(eq(sources.id, sourceRow.id)).run();
    bumpSourcesEpoch(sourceRow.notebookId);
  }

  return {
    sourceId: sourceRow.id,
    filename: sourceRow.filename,
    chunkCount: chunkTexts.length,
  };
}

/** Replay current state to a new SSE subscriber, then keep listening. */
export async function streamRun(
  notebookId: number,
  runId: number,
  emit: SseEmit,
): Promise<() => void> {
  const row = requireRun(notebookId, runId);
  const unsub = subscribeRun(runId, emit);
  emit('status', { status: row.status });
  const graph = getGraph(row);
  if (graph.nodes.length || graph.edges.length) {
    emit('graph_patch', {
      nodes: graph.nodes,
      edges: graph.edges,
    } satisfies ResearchGraphPatch);
  }
  if (row.status === 'awaiting_confirm' && row.confirmKind) {
    emit('confirm', {
      kind: row.confirmKind,
      branchNodeId: row.confirmBranchNodeId ?? undefined,
      options:
        row.confirmKind === 'budget'
          ? ['continue', 'finish_report']
          : ['approve_branch', 'skip_branch'],
    });
  }
  if (row.status === 'completed') {
    emit('report_ready', { runId });
  }
  return unsub;
}

export function createResearchSseResponse(notebookId: number, runId: number): Response {
  requireRun(notebookId, runId);
  const sse = (event: string, data: unknown): string =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  let unsub: (() => void) | undefined;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit: SseEmit = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sse(event, data)));
        } catch {
          closed = true;
        }
      };
      try {
        unsub = await streamRun(notebookId, runId, emit);
        // Keep connection open until client cancels or run reaches terminal
        // and a short grace period. Poll status for terminal close.
        await new Promise<void>((resolve) => {
          const tick = () => {
            if (closed) {
              resolve();
              return;
            }
            const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
            if (
              row &&
              (row.status === 'completed' || row.status === 'failed' || row.status === 'cancelled')
            ) {
              // Allow final events to flush
              setTimeout(() => resolve(), 50);
              return;
            }
            setTimeout(tick, 100);
          };
          tick();
        });
      } catch (error) {
        emit('error', {
          errorCode: error instanceof AppHttpError ? error.code : ErrorCode.INTERNAL_ERROR,
          message: String(error),
        });
      } finally {
        unsub?.();
        if (!closed) {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
    cancel() {
      closed = true;
      unsub?.();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
    },
  });
}
