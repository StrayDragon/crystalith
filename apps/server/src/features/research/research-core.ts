/**
 * Deep Research shared state + serialize/broadcast/db helpers.
 * No imports from run-loop / commands / report / node-chat (cycle bridge).
 */
import type {
  ResearchEvidence,
  ResearchGraphPatch,
  ResearchNode,
  ResearchNodeRole,
  ResearchProgressEvent,
  ResearchProgressKind,
  ResearchRun,
  ResearchRunStatus,
  ResearchRunSummary,
} from '@crystalith/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import {
  notebooks,
  researchEvidences,
  researchProgressEvents,
  researchRuns,
  type ResearchCheckpointJson,
  type ResearchGraphJson,
} from '../../db/schema.ts';
import { config, ResearchSettingsSchema } from '../../shared/config.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';

export type SseEmit = (event: string, data: unknown) => void;

export type RunRow = typeof researchRuns.$inferSelect;

/** In-memory subscribers for live SSE (per run). */
export const runEmitters = new Map<number, Set<SseEmit>>();

/** Runs currently executing (dedupe schedule). */
export const activeLoops = new Set<number>();

/** Per-run AbortController for cancel → abort active work-unit. */
export const runAbortControllers = new Map<number, AbortController>();

/** Per-run node-chat AbortControllers (`${runId}:${nodeId}`). */
export const chatAbortControllers = new Map<string, AbortController>();

export const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

export function emptyGraph(): ResearchGraphJson {
  return { nodes: [], edges: [] };
}

export function ensureRunAbortController(runId: number): AbortController {
  let ac = runAbortControllers.get(runId);
  if (!ac || ac.signal.aborted) {
    ac = new AbortController();
    runAbortControllers.set(runId, ac);
  }
  return ac;
}

export function clearRunAbortController(runId: number): void {
  runAbortControllers.delete(runId);
}

export function abortRunWorkUnit(runId: number): void {
  const ac = runAbortControllers.get(runId);
  if (ac && !ac.signal.aborted) ac.abort();
}

export function chatKey(runId: number, nodeId: string): string {
  return `${runId}:${nodeId}`;
}

export function abortAllChatsForRun(runId: number): void {
  const prefix = `${runId}:`;
  for (const [key, ac] of chatAbortControllers) {
    if (!key.startsWith(prefix)) continue;
    if (!ac.signal.aborted) ac.abort();
    chatAbortControllers.delete(key);
  }
}

export function getProgressEventRetain(): number {
  const parsed = ResearchSettingsSchema.safeParse(config().raw.research ?? {});
  return parsed.success ? parsed.data.progressEventRetain : 200;
}

export function resolveNodeRole(node: Pick<ResearchNode, 'id' | 'role'>): ResearchNodeRole {
  if (node.role) return node.role;
  if (node.id.startsWith('node_conclusion')) return 'conclusion';
  if (node.id.startsWith('node_root')) return 'question';
  return 'research';
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Role first, then id prefix compat (node_root_ / node_conclusion_). */
export function isPruneProtectedNode(
  node: Pick<ResearchNode, 'id' | 'role'> | undefined,
  nodeId?: string,
): boolean {
  const id = node?.id ?? nodeId ?? '';
  if (node?.role === 'question' || node?.role === 'conclusion') return true;
  if (node?.role === 'research') return false;
  return id.startsWith('node_root') || id.startsWith('node_conclusion');
}

export function findQuestionNode(nodes: ResearchNode[]): ResearchNode | undefined {
  return (
    nodes.find((n) => n.role === 'question') ?? nodes.find((n) => n.id.startsWith('node_root'))
  );
}

export function findConclusionNode(nodes: ResearchNode[]): ResearchNode | undefined {
  return (
    nodes.find((n) => n.role === 'conclusion') ??
    nodes.find((n) => n.id.startsWith('node_conclusion'))
  );
}

/** Seed single-sink DAG: one question + one empty conclusion (r317). */
export function seedSingleSinkGraph(topic: string): {
  question: ResearchNode;
  conclusion: ResearchNode;
  graph: ResearchGraphJson;
} {
  const question: ResearchNode = {
    id: newId('node_root'),
    role: 'question',
    title: topic,
    query: topic,
    conclusionStatus: 'pending',
    phase: 'retrieving',
    evidenceIds: [],
  };
  const conclusion: ResearchNode = {
    id: newId('node_conclusion'),
    role: 'conclusion',
    title: '结论',
    conclusionStatus: 'pending',
    phase: 'idle',
    evidenceIds: [],
  };
  return {
    question,
    conclusion,
    graph: { nodes: [question, conclusion], edges: [] },
  };
}

export function getGraph(row: RunRow): ResearchGraphJson {
  return row.graph ?? emptyGraph();
}

export function writeCheckpoint(row: RunRow, reason?: string): ResearchCheckpointJson {
  const graph = getGraph(row);
  return {
    at: new Date().toISOString(),
    status: row.status,
    searchesUsed: row.searchesUsed,
    nodeCount: graph.nodes.length,
    reason,
  };
}

export function broadcast(runId: number, event: string, data: unknown): void {
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
  const emitters = set;
  emitters.add(emit);
  return () => {
    emitters.delete(emit);
    if (emitters.size === 0) runEmitters.delete(runId);
  };
}

export function serializeRun(row: RunRow): ResearchRun {
  const graph = getGraph(row);
  return {
    id: row.id,
    notebookId: row.notebookId,
    topic: row.topic,
    status: row.status,
    useNotebookSources: row.useNotebookSources,
    allowWeb: row.allowWeb,
    sourceIds: row.sourceIds ?? null,
    depth: row.depth,
    maxSearches: row.maxSearches,
    maxNodes: row.maxNodes,
    searchesUsed: row.searchesUsed,
    maxPageFetches: row.maxPageFetches,
    pagesUsed: row.pagesUsed,
    nodes: graph.nodes,
    edges: graph.edges,
    evidences: listEvidences(row.id),
    report: row.report ?? null,
    confirmKind: row.confirmKind ?? null,
    confirmBranchNodeId: row.confirmBranchNodeId ?? null,
    modelId: row.modelId ?? null,
    failureReason: row.errorMessage ?? null,
    // oxlint-disable-next-line typescript/no-deprecated -- wire compat for older clients
    errorMessage: row.errorMessage ?? null,
    llmActivity: row.llmActivity ?? null,
    activeNodeId: row.activeNodeId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeRunSummary(row: RunRow): ResearchRunSummary {
  return {
    id: row.id,
    notebookId: row.notebookId,
    topic: row.topic,
    status: row.status,
    useNotebookSources: row.useNotebookSources,
    allowWeb: row.allowWeb,
    sourceIds: row.sourceIds ?? null,
    depth: row.depth,
    maxSearches: row.maxSearches,
    maxNodes: row.maxNodes,
    searchesUsed: row.searchesUsed,
    maxPageFetches: row.maxPageFetches,
    pagesUsed: row.pagesUsed,
    confirmKind: row.confirmKind ?? null,
    modelId: row.modelId ?? null,
    failureReason: row.errorMessage ?? null,
    // oxlint-disable-next-line typescript/no-deprecated -- wire compat for older clients
    errorMessage: row.errorMessage ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function requireNotebook(notebookId: number): void {
  const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
  if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);
}

export function requireRun(notebookId: number, runId: number): RunRow {
  const row = db()
    .select()
    .from(researchRuns)
    .where(and(eq(researchRuns.id, runId), eq(researchRuns.notebookId, notebookId)))
    .get();
  if (!row) throw new NotFoundError(`Research run ${runId} not found`);
  return row;
}

export function assertLiveMutable(status: string): void {
  if (status !== 'running' && status !== 'awaiting_confirm') {
    throw new AppHttpError(
      ErrorCode.RESEARCH_INVALID_STATE,
      `Cannot modify graph when status is ${status}`,
    );
  }
}

export function updateRun(runId: number, patch: Partial<typeof researchRuns.$inferInsert>): RunRow {
  const row = db()
    .update(researchRuns)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(researchRuns.id, runId))
    .returning()
    .get();
  if (!row) throw new NotFoundError(`Research run ${runId} not found`);
  return row;
}

export function persistGraph(
  runId: number,
  graph: ResearchGraphJson,
  extra?: Partial<RunRow>,
): RunRow {
  return updateRun(runId, { graph, ...extra });
}

export function insertEvidence(
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
      content: evidence.content ?? null,
      url: evidence.url ?? null,
      sourceId: evidence.sourceId ?? null,
      chunkId: evidence.chunkId ?? null,
      collectedAtNodeId: evidence.collectedAtNodeId ?? null,
    })
    .run();
  return { ...evidence, id };
}

/**
 * Upgrade same-URL web evidence with truncated page body (c107).
 * Finds existing web evidence by runId+url; updates content (and title if provided);
 * otherwise inserts a new web row.
 */
export function upsertWebEvidenceContent(
  runId: number,
  notebookId: number,
  nodeId: string,
  url: string,
  title: string,
  content: string,
): ResearchEvidence {
  const existing = db()
    .select()
    .from(researchEvidences)
    .where(
      and(
        eq(researchEvidences.runId, runId),
        eq(researchEvidences.kind, 'web'),
        eq(researchEvidences.url, url),
      ),
    )
    .get();

  if (existing) {
    db()
      .update(researchEvidences)
      .set({
        content,
        title: title.trim() || existing.title,
      })
      .where(eq(researchEvidences.id, existing.id))
      .run();
    return {
      id: existing.id,
      kind: 'web',
      title: title.trim() || existing.title,
      snippet: existing.snippet ?? undefined,
      content,
      url: existing.url ?? url,
      sourceId: existing.sourceId ?? undefined,
      chunkId: existing.chunkId ?? undefined,
      collectedAtNodeId: existing.collectedAtNodeId ?? undefined,
    };
  }

  return insertEvidence(runId, notebookId, {
    kind: 'web',
    title: title.trim() || url,
    content,
    url,
    collectedAtNodeId: nodeId,
  });
}

export function listEvidences(runId: number): ResearchEvidence[] {
  return db()
    .select()
    .from(researchEvidences)
    .where(eq(researchEvidences.runId, runId))
    .all()
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      snippet: e.snippet ?? undefined,
      content: e.content ?? undefined,
      url: e.url ?? undefined,
      sourceId: e.sourceId ?? undefined,
      chunkId: e.chunkId ?? undefined,
      collectedAtNodeId: e.collectedAtNodeId ?? undefined,
    }));
}

export function emitGraphPatch(runId: number, patch: ResearchGraphPatch): void {
  broadcast(runId, 'graph_patch', patch);
}

export function appendProgressEvent(
  runId: number,
  kind: ResearchProgressKind,
  opts?: {
    nodeId?: string | null;
    headline?: string | null;
    payload?: Record<string, unknown> | null;
  },
): ResearchProgressEvent {
  const maxSeq =
    db()
      .select({ value: sql<number>`coalesce(max(${researchProgressEvents.seq}), 0)` })
      .from(researchProgressEvents)
      .where(eq(researchProgressEvents.runId, runId))
      .get()?.value ?? 0;
  const seq = maxSeq + 1;
  const id = newId('pe');
  const at = new Date();
  db()
    .insert(researchProgressEvents)
    .values({
      id,
      runId,
      seq,
      at,
      kind,
      nodeId: opts?.nodeId ?? null,
      headline: opts?.headline ?? null,
      payload: opts?.payload ?? null,
    })
    .run();
  const event: ResearchProgressEvent = {
    id,
    runId,
    seq,
    at: at.toISOString(),
    kind,
    nodeId: opts?.nodeId ?? null,
    headline: opts?.headline ?? null,
    payload: opts?.payload ?? null,
  };
  broadcast(runId, 'progress', {
    seq: event.seq,
    kind: event.kind,
    at: event.at,
    nodeId: event.nodeId ?? undefined,
    headline: event.headline ?? undefined,
    payload: event.payload ?? undefined,
  });
  return event;
}

export function truncateProgressEvents(runId: number): void {
  const retain = getProgressEventRetain();
  const rows = db()
    .select({ id: researchProgressEvents.id, seq: researchProgressEvents.seq })
    .from(researchProgressEvents)
    .where(eq(researchProgressEvents.runId, runId))
    .orderBy(desc(researchProgressEvents.seq))
    .all();
  if (rows.length <= retain) return;
  const keep = new Set(rows.slice(0, retain).map((r) => r.id));
  for (const row of rows) {
    if (keep.has(row.id)) continue;
    db().delete(researchProgressEvents).where(eq(researchProgressEvents.id, row.id)).run();
  }
}

export function statusToProgressKind(status: ResearchRunStatus): ResearchProgressKind | null {
  switch (status) {
    case 'queued':
      return 'run_queued';
    case 'running':
      return 'run_running';
    case 'awaiting_confirm':
      return 'run_awaiting_confirm';
    case 'completed':
      return 'run_completed';
    case 'failed':
      return 'run_failed';
    case 'cancelled':
      return 'run_cancelled';
    default:
      return null;
  }
}

export function emitStatus(runId: number, status: ResearchRunStatus, reason?: string): void {
  broadcast(runId, 'status', reason ? { status, reason } : { status });
  const kind = statusToProgressKind(status);
  if (kind) {
    appendProgressEvent(runId, kind, {
      headline: reason ?? status,
      payload: reason ? { reason } : null,
    });
  }
  if (isTerminalStatus(status)) {
    truncateProgressEvents(runId);
  }
}

export function emitLog(runId: number, message: string): void {
  broadcast(runId, 'log', { message, at: new Date().toISOString() });
}

export function isCancelled(runId: number): boolean {
  const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
  // AbortSignal is also used for cooperative reexpand pause — do not treat abort alone
  // as user cancel (c104/c108). Callers that need abort should check AbortSignal directly.
  return Boolean(row?.cancelRequested) || row?.status === 'cancelled';
}

export function requireFresh(runId: number): RunRow {
  const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
  if (!row) throw new NotFoundError(`Research run ${runId} not found`);
  return row;
}

export function finalizeCancel(runId: number): void {
  const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
  // Never clobber a terminal Run (completed/failed/cancelled). Cooperative reexpand
  // abort can race with skip_reexpand → synthesize finishing first.
  if (!row || isTerminalStatus(row.status)) return;
  updateRun(runId, {
    status: 'cancelled',
    checkpoint: writeCheckpoint(row, 'cancel'),
    cancelRequested: true,
  });
  emitStatus(runId, 'cancelled');
  emitLog(runId, '研究已取消');
}
