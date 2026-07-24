/**
 * Deep Research runtime — ResearchRun persistence + pragmatic orchestrator.
 *
 * Flow: create → queued → running → (optional awaiting_confirm) → completed.
 * FE Desk/xyflow is under apps/web workspace research; this module is HTTP +
 * persistence + SSE only.
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
  ResearchNodeActionProposal,
  ResearchNodeChatBody,
  ResearchNodePatchBody,
  ResearchNodeRole,
  ResearchProgressEvent,
  ResearchProgressKind,
  ResearchReport,
  ResearchReportView,
  ResearchRevision,
  ResearchRevisionCreateBody,
  ResearchRun,
  ResearchRunStatus,
  ResearchRunSummary,
} from '@crystalith/shared';
import { RESEARCH_DEPTH_BUDGETS } from '@crystalith/shared';
import { and, asc, count, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { NotFoundError } from 'elysia';

import { searchWeb } from '../../ai/tools/web-search.ts';
import { db } from '../../db/index.ts';
import {
  chunks,
  notebooks,
  outputs,
  researchEvidences,
  researchProgressEvents,
  researchReportEdits,
  researchRevisions,
  researchRuns,
  sources,
  type ResearchCheckpointJson,
  type ResearchGraphJson,
  type ResearchReportJson,
} from '../../db/schema.ts';
import { bumpSourcesEpoch } from '../../rag/cache.ts';
import { ragRegistry } from '../../rag/registry.ts';
import { config, ResearchSettingsSchema } from '../../shared/config.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { splitTextToChunks } from '../outputs/render.ts';
import { applyDecomposePlanToGraph, planTopicDecomposition } from './decompose.ts';
import { createResearchNodeAgent, proposalFromStructureToolCall } from './node-agent.ts';
import { hasLiveResearchBranches, orderResearchNodesForWork } from './research-work-queue.ts';

export type SseEmit = (event: string, data: unknown) => void;

type RunRow = typeof researchRuns.$inferSelect;

/** In-memory subscribers for live SSE (per run). */
const runEmitters = new Map<number, Set<SseEmit>>();

/** Runs currently executing (dedupe schedule). */
const activeLoops = new Set<number>();

/** Per-run AbortController for cancel → abort active work-unit. */
const runAbortControllers = new Map<number, AbortController>();

/** Per-run node-chat AbortControllers (`${runId}:${nodeId}`). */
const chatAbortControllers = new Map<string, AbortController>();

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

function emptyGraph(): ResearchGraphJson {
  return { nodes: [], edges: [] };
}

function ensureRunAbortController(runId: number): AbortController {
  let ac = runAbortControllers.get(runId);
  if (!ac || ac.signal.aborted) {
    ac = new AbortController();
    runAbortControllers.set(runId, ac);
  }
  return ac;
}

function clearRunAbortController(runId: number): void {
  runAbortControllers.delete(runId);
}

function abortRunWorkUnit(runId: number): void {
  const ac = runAbortControllers.get(runId);
  if (ac && !ac.signal.aborted) ac.abort();
}

function chatKey(runId: number, nodeId: string): string {
  return `${runId}:${nodeId}`;
}

function abortAllChatsForRun(runId: number): void {
  const prefix = `${runId}:`;
  for (const [key, ac] of chatAbortControllers) {
    if (!key.startsWith(prefix)) continue;
    if (!ac.signal.aborted) ac.abort();
    chatAbortControllers.delete(key);
  }
}

function getProgressEventRetain(): number {
  const parsed = ResearchSettingsSchema.safeParse(config().raw.research ?? {});
  return parsed.success ? parsed.data.progressEventRetain : 200;
}

function resolveNodeRole(node: Pick<ResearchNode, 'id' | 'role'>): ResearchNodeRole {
  if (node.role) return node.role;
  if (node.id.startsWith('node_conclusion')) return 'conclusion';
  if (node.id.startsWith('node_root')) return 'question';
  return 'research';
}

function isTerminalStatus(status: string): boolean {
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

function findQuestionNode(nodes: ResearchNode[]): ResearchNode | undefined {
  return (
    nodes.find((n) => n.role === 'question') ?? nodes.find((n) => n.id.startsWith('node_root'))
  );
}

function findConclusionNode(nodes: ResearchNode[]): ResearchNode | undefined {
  return (
    nodes.find((n) => n.role === 'conclusion') ??
    nodes.find((n) => n.id.startsWith('node_conclusion'))
  );
}

/** Seed single-sink DAG: one question + one empty conclusion (r317). */
function seedSingleSinkGraph(topic: string): {
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
    evidences: listEvidences(row.id),
    report: (row.report as ResearchReport | null) ?? null,
    confirmKind: (row.confirmKind as 'budget' | 'expand_branch' | null) ?? null,
    confirmBranchNodeId: row.confirmBranchNodeId ?? null,
    errorMessage: row.errorMessage ?? null,
    llmActivity: (row.llmActivity as ResearchRun['llmActivity']) ?? null,
    activeNodeId: row.activeNodeId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRunSummary(row: RunRow): ResearchRunSummary {
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
    confirmKind: (row.confirmKind as 'budget' | 'expand_branch' | null) ?? null,
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
  const useNotebookSources = body.useNotebookSources ?? false;
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
  statusFilter?: ResearchRunStatus[],
): { items: ResearchRunSummary[]; total: number; offset: number; limit: number } {
  requireNotebook(notebookId);
  const whereClause =
    statusFilter && statusFilter.length > 0
      ? and(eq(researchRuns.notebookId, notebookId), inArray(researchRuns.status, statusFilter))
      : eq(researchRuns.notebookId, notebookId);
  const total =
    db().select({ value: count() }).from(researchRuns).where(whereClause).get()?.value ?? 0;
  const rows = db()
    .select()
    .from(researchRuns)
    .where(whereClause)
    .orderBy(desc(researchRuns.updatedAt))
    .limit(limit)
    .offset(offset)
    .all();
  return { items: rows.map(serializeRunSummary), total, offset, limit };
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

function appendProgressEvent(
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
  const seq = Number(maxSeq) + 1;
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

function truncateProgressEvents(runId: number): void {
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

function statusToProgressKind(status: ResearchRunStatus): ResearchProgressKind | null {
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

function emitStatus(runId: number, status: ResearchRunStatus, reason?: string): void {
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

function emitLog(runId: number, message: string): void {
  broadcast(runId, 'log', { message, at: new Date().toISOString() });
}

function isCancelled(runId: number): boolean {
  const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
  if (Boolean(row?.cancelRequested) || row?.status === 'cancelled') return true;
  return Boolean(runAbortControllers.get(runId)?.signal.aborted);
}

/** Schedule async execution (microtask). */
export function scheduleRun(runId: number): void {
  if (activeLoops.has(runId)) return;
  queueMicrotask(() => {
    void runLoop(runId);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Apply a Work tool result into research_evidences; returns new evidence ids + search delta. */
function ingestWorkToolResult(
  runId: number,
  notebookId: number,
  nodeId: string,
  toolName: string,
  output: unknown,
): { evidenceIds: string[]; searchesDelta: number } {
  const evidenceIds: string[] = [];
  let searchesDelta = 0;
  if (toolName === 'webSearch' && Array.isArray(output)) {
    searchesDelta = 1;
    for (const item of output) {
      if (!isRecord(item)) continue;
      const ev = insertEvidence(runId, notebookId, {
        kind: 'web',
        title: typeof item.title === 'string' ? item.title : String(item.url ?? 'web'),
        snippet: typeof item.snippet === 'string' ? item.snippet : undefined,
        url: typeof item.url === 'string' ? item.url : undefined,
        collectedAtNodeId: nodeId,
      });
      evidenceIds.push(ev.id);
    }
  } else if (toolName === 'retrieveSources' && Array.isArray(output)) {
    for (const item of output) {
      if (!isRecord(item)) continue;
      const sourceId = typeof item.sourceId === 'number' ? item.sourceId : undefined;
      const chunkId =
        typeof item.chunkId === 'number' || typeof item.chunkId === 'string'
          ? String(item.chunkId)
          : undefined;
      const chunkIndex = typeof item.chunkIndex === 'number' ? item.chunkIndex : 0;
      const text = typeof item.text === 'string' ? item.text : '';
      const ev = insertEvidence(runId, notebookId, {
        kind: 'chunk',
        title: `来源 ${sourceId ?? '?'} · chunk ${chunkIndex}`,
        snippet: text.slice(0, 500),
        sourceId,
        chunkId,
        collectedAtNodeId: nodeId,
      });
      evidenceIds.push(ev.id);
    }
  }
  return { evidenceIds, searchesDelta };
}

/**
 * Node work-unit via ToolLoopAgent (mode=work_unit). Falls back to pragmatic
 * RAG/searchWeb when no model / agent fails / no tool results collected.
 */
async function runNodeWorkUnit(opts: {
  runId: number;
  notebookId: number;
  node: ResearchNode;
  topic: string;
  allowWeb: boolean;
  useNotebookSources: boolean;
  sourceIds: number[] | null;
  searchesUsed: number;
  maxSearches: number;
  abortSignal: AbortSignal;
}): Promise<{ evidenceIds: string[]; searchesUsed: number; via: 'agent' | 'pragmatic' }> {
  const {
    runId,
    notebookId,
    node,
    topic,
    allowWeb,
    useNotebookSources,
    sourceIds,
    maxSearches,
    abortSignal,
  } = opts;
  let searchesUsed = opts.searchesUsed;
  const evidenceIds: string[] = [...(node.evidenceIds ?? [])];
  const role = resolveNodeRole(node);

  updateRun(runId, { llmActivity: 'work_unit', activeNodeId: node.id });
  appendProgressEvent(runId, 'unit_started', {
    nodeId: node.id,
    headline: `work_unit:${node.id}`,
  });

  const agent = await createResearchNodeAgent(notebookId);
  let via: 'agent' | 'pragmatic' = 'pragmatic';
  let toolHits = 0;

  if (agent) {
    try {
      const result = await agent.stream({
        prompt: [
          `研究主题：${topic}`,
          `节点：${node.title}`,
          node.query ? `查询：${node.query}` : '',
          '请使用可用工具收集证据，然后用一两句话总结。',
        ]
          .filter(Boolean)
          .join('\n'),
        abortSignal,
        options: {
          mode: 'work_unit',
          role,
          nodeId: node.id,
          nodeTitle: node.title,
          nodeQuery: node.query,
          allowWeb,
          useNotebookSources: useNotebookSources && Boolean(sourceIds?.length),
        } as never,
      });

      for await (const part of result.stream) {
        if (abortSignal.aborted || isCancelled(runId)) break;
        if (part.type === 'tool-result') {
          const toolName = 'toolName' in part ? String(part.toolName) : '';
          const output = 'output' in part ? part.output : undefined;
          if (toolName === 'webSearch') {
            if (searchesUsed >= maxSearches) {
              throw new AppHttpError(ErrorCode.RESEARCH_BUDGET, 'Web search budget exhausted');
            }
          }
          const ingested = ingestWorkToolResult(runId, notebookId, node.id, toolName, output);
          evidenceIds.push(...ingested.evidenceIds);
          if (ingested.searchesDelta > 0) {
            searchesUsed += ingested.searchesDelta;
            updateRun(runId, { searchesUsed });
          }
          if (ingested.evidenceIds.length) toolHits += 1;
          emitLog(
            runId,
            toolName === 'webSearch'
              ? `外网检索：${ingested.evidenceIds.length} 条`
              : toolName === 'retrieveSources'
                ? `检索笔记本：${ingested.evidenceIds.length} 条`
                : `工具 ${toolName} 完成`,
          );
        } else if (part.type === 'text-delta') {
          // work-unit text is logged lightly; report synthesis stays deterministic
        } else if (part.type === 'error') {
          throw new Error(
            'error' in part && part.error instanceof Error
              ? part.error.message
              : 'work_unit generation error',
          );
        }
      }
      via = 'agent';
    } catch (error) {
      if (abortSignal.aborted || isCancelled(runId)) throw error;
      console.warn('[research] work_unit agent failed; using pragmatic path:', error);
      via = 'pragmatic';
      toolHits = 0;
    }
  }

  const needsPragmatic =
    via === 'pragmatic' ||
    (toolHits === 0 && (allowWeb || (useNotebookSources && Boolean(sourceIds?.length))));

  if (needsPragmatic && !abortSignal.aborted && !isCancelled(runId)) {
    via = 'pragmatic';
    // Notebook retrieve
    if (useNotebookSources && sourceIds?.length) {
      try {
        const hits = await ragRegistry.retrieveWith('embed', notebookId, topic, {
          topK: 5,
          minScore: 0,
          sourceIds,
        });
        for (const hit of hits) {
          if (isCancelled(runId) || abortSignal.aborted) break;
          const ev = insertEvidence(runId, notebookId, {
            kind: 'chunk',
            title: `来源 ${hit.sourceId} · chunk ${hit.chunkIndex}`,
            snippet: hit.text.slice(0, 500),
            sourceId: hit.sourceId,
            chunkId: String(hit.chunkId),
            collectedAtNodeId: node.id,
          });
          evidenceIds.push(ev.id);
        }
        emitLog(runId, `检索笔记本：${hits.length} 条`);
      } catch (error) {
        emitLog(runId, `笔记本检索失败：${String(error)}`);
      }
    }

    if (allowWeb) {
      if (searchesUsed >= maxSearches) {
        throw new AppHttpError(ErrorCode.RESEARCH_BUDGET, 'Web search budget exhausted');
      }
      try {
        const results = await searchWeb(topic, { maxResults: 5 });
        searchesUsed += 1;
        updateRun(runId, { searchesUsed });
        for (const item of results) {
          const ev = insertEvidence(runId, notebookId, {
            kind: 'web',
            title: item.title || item.url,
            snippet: item.snippet,
            url: item.url,
            collectedAtNodeId: node.id,
          });
          evidenceIds.push(ev.id);
        }
        emitLog(runId, `外网检索：${results.length} 条`);
      } catch (error) {
        if (error instanceof AppHttpError) throw error;
        emitLog(runId, `外网检索失败：${String(error)}`);
      }
    }
  }

  appendProgressEvent(runId, 'unit_finished', {
    nodeId: node.id,
    headline: `work_unit done (${via})`,
    payload: { evidenceCount: evidenceIds.length, via },
  });

  return { evidenceIds, searchesUsed, via };
}

function patchNodePhase(
  runId: number,
  nodeId: string,
  phase: ResearchNode['phase'],
): ResearchNode | null {
  const row = requireFresh(runId);
  const graph = getGraph(row);
  const live = graph.nodes.find((n) => n.id === nodeId) as ResearchNode | undefined;
  if (!live || live.conclusionStatus === 'pruned') return null;
  const updated: ResearchNode = { ...live, phase };
  const idx = graph.nodes.findIndex((n) => n.id === updated.id);
  if (idx >= 0) graph.nodes[idx] = updated;
  else graph.nodes.push(updated);
  persistGraph(runId, graph);
  emitGraphPatch(runId, { nodes: [updated] });
  return updated;
}

/** Persist work-unit results onto a live node (discard-if-pruned). */
function writeBackNodeWork(
  runId: number,
  nodeId: string,
  evidenceIds: string[],
): ResearchNode | null {
  const row = requireFresh(runId);
  const graph = getGraph(row);
  const live = graph.nodes.find((n) => n.id === nodeId) as ResearchNode | undefined;
  if (!live || live.conclusionStatus === 'pruned') return null;
  const updated: ResearchNode = {
    ...live,
    phase: 'idle',
    conclusionStatus: evidenceIds.length > 0 ? 'partial' : 'missing',
    summary: evidenceIds.length ? `已收集 ${evidenceIds.length} 条证据` : '未收集到证据',
    evidenceIds,
  };
  const idx = graph.nodes.findIndex((n) => n.id === updated.id);
  if (idx >= 0) graph.nodes[idx] = updated;
  else graph.nodes.push(updated);
  persistGraph(runId, graph);
  emitGraphPatch(runId, { nodes: [updated] });
  updateRun(runId, {
    checkpoint: writeCheckpoint(requireFresh(runId), 'node_complete'),
  });
  return updated;
}

/** Serial work units for live research nodes (c93 branches + fork children). */
async function drainResearchWorkUnits(runId: number, abortSignal: AbortSignal): Promise<void> {
  while (!abortSignal.aborted && !isCancelled(runId)) {
    const row = requireFresh(runId);
    const graph = getGraph(row);
    // F2=B: stable insertion-order queue (orderResearchNodesForWork)
    const pending = orderResearchNodesForWork(graph.nodes as ResearchNode[]);
    if (pending.length === 0) return;
    const node = pending[0]!;

    // F4=A: budget exhausted → mark missing and continue (no hard stop here)
    if (row.allowWeb && row.searchesUsed >= row.maxSearches) {
      emitLog(runId, `跳过研究节点 ${node.id}：搜索预算已尽`);
      appendProgressEvent(runId, 'unit_aborted', {
        nodeId: node.id,
        headline: '预算已尽，跳过节点',
      });
      writeBackNodeWork(runId, node.id, node.evidenceIds ?? []);
      continue;
    }

    patchNodePhase(runId, node.id, 'retrieving');
    appendProgressEvent(runId, 'node_phase', {
      nodeId: node.id,
      headline: 'retrieving',
      payload: { phase: 'retrieving' },
    });
    // unit_started emitted inside runNodeWorkUnit (single ledger entry per unit)

    const fresh = requireFresh(runId);
    const work = await runNodeWorkUnit({
      runId,
      notebookId: fresh.notebookId,
      node,
      topic: node.query?.trim() || fresh.topic,
      allowWeb: fresh.allowWeb && fresh.searchesUsed < fresh.maxSearches,
      useNotebookSources: fresh.useNotebookSources,
      sourceIds: fresh.sourceIds ?? null,
      searchesUsed: fresh.searchesUsed,
      maxSearches: fresh.maxSearches,
      abortSignal,
    });
    if (abortSignal.aborted || isCancelled(runId)) return;
    const written = writeBackNodeWork(runId, node.id, work.evidenceIds);
    if (!written) {
      emitLog(runId, `研究节点 ${node.id} 已剪枝，跳过写回`);
      appendProgressEvent(runId, 'unit_skipped_pruned', { nodeId: node.id });
    } else {
      appendProgressEvent(runId, 'unit_finished', {
        nodeId: node.id,
        headline: written.summary ?? '支路完成',
        payload: { evidenceCount: work.evidenceIds.length },
      });
    }
  }
}

async function runLoop(runId: number): Promise<void> {
  if (activeLoops.has(runId)) return;
  activeLoops.add(runId);
  const abort = ensureRunAbortController(runId);
  try {
    let row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
    if (!row) return;
    if (row.status !== 'queued' && row.status !== 'running') return;

    row = updateRun(runId, { status: 'running', llmActivity: 'work_unit', activeNodeId: null });
    emitStatus(runId, 'running');
    emitLog(runId, `开始研究「${row.topic}」`);
    appendProgressEvent(runId, 'unit_started', { headline: 'work_unit' });

    if (isCancelled(runId) || abort.signal.aborted) {
      finalizeCancel(runId);
      return;
    }

    // Seed single-sink DAG (question + conclusion) at start of loop (r317).
    let graph = getGraph(row);
    let question = findQuestionNode(graph.nodes as ResearchNode[]);
    let conclusion = findConclusionNode(graph.nodes as ResearchNode[]);
    if (!question || !conclusion) {
      const seeded = seedSingleSinkGraph(row.topic);
      question = seeded.question;
      conclusion = seeded.conclusion;
      graph = seeded.graph;
      row = persistGraph(runId, graph, {
        checkpoint: writeCheckpoint({ ...row, status: 'running' }, 'seed_graph'),
      });
      emitGraphPatch(runId, {
        nodes: [question, conclusion],
        edges: [],
      });
      emitLog(runId, '已种子单结论 DAG');
    }

    // c93 / r326: auto-decompose topic into research nodes (topology only; c94 runs units).
    if (isCancelled(runId) || abort.signal.aborted) {
      finalizeCancel(runId);
      return;
    }
    row = requireFresh(runId);
    graph = getGraph(row);
    {
      const occupied = graph.nodes.filter((n) => n.conclusionStatus !== 'pruned').length;
      try {
        const plan = await planTopicDecomposition({
          topic: row.topic,
          depth: (row.depth ?? 'medium') as ResearchDepth,
          maxNodes: row.maxNodes,
          occupiedNodes: occupied,
          abortSignal: abort.signal,
        });
        if (plan && plan.branches.length > 0) {
          const applied = applyDecomposePlanToGraph(graph, plan, newId);
          if (applied.addedNodes.length > 0) {
            row = persistGraph(runId, applied.graph, {
              checkpoint: writeCheckpoint({ ...row, status: 'running' }, 'decompose'),
            });
            emitGraphPatch(runId, {
              nodes: applied.addedNodes,
              edges: applied.addedEdges,
            });
            appendProgressEvent(runId, 'graph_patched_summary', {
              headline: `已拆解 ${applied.addedNodes.length} 个研究支路`,
              payload: { researchNodes: applied.addedNodes.length },
            });
            emitLog(runId, `已拆解 ${applied.addedNodes.length} 个研究支路`);
          } else {
            appendProgressEvent(runId, 'unit_aborted', {
              headline: '拆解结果未写入，改走单路径',
            });
            emitLog(runId, '主题拆解未写入节点，改走单路径');
          }
        } else {
          appendProgressEvent(runId, 'unit_aborted', {
            headline: '拆解跳过或为空，改走单路径',
          });
          emitLog(runId, '主题拆解为空或不可用，改走单路径');
        }
      } catch (error) {
        appendProgressEvent(runId, 'unit_aborted', {
          headline: '拆解失败，改走单路径',
        });
        emitLog(runId, `主题拆解失败：${String(error)}，改走单路径`);
      }
    }

    // F1=A: live research branches → skip question work-unit; drain branches only.
    // No branches → keep question → drain (fork children / empty decompose fallback).
    row = requireFresh(runId);
    graph = getGraph(row);
    question = findQuestionNode(graph.nodes as ResearchNode[])!;
    if (question.conclusionStatus === 'pruned') {
      emitLog(runId, `跳过已剪枝节点 ${question.id}`);
      await synthesizeAndComplete(runId);
      return;
    }

    const skipQuestionUnit = hasLiveResearchBranches(graph.nodes as ResearchNode[]);
    if (!skipQuestionUnit) {
      const evidenceIds: string[] = [...(question.evidenceIds ?? [])];

      // Budget gate before spending search (question-only path)
      if (row.allowWeb) {
        if (row.searchesUsed >= row.maxSearches) {
          throw new AppHttpError(ErrorCode.RESEARCH_BUDGET, 'Web search budget exhausted');
        }
        const approaching = row.searchesUsed >= Math.max(1, row.maxSearches - 1);
        if (approaching && row.searchesUsed > 0) {
          await enterConfirm(runId, 'budget');
          return;
        }
      }

      const work = await runNodeWorkUnit({
        runId,
        notebookId: row.notebookId,
        node: question,
        topic: row.topic,
        allowWeb: row.allowWeb,
        useNotebookSources: row.useNotebookSources,
        sourceIds: row.sourceIds ?? null,
        searchesUsed: row.searchesUsed,
        maxSearches: row.maxSearches,
        abortSignal: abort.signal,
      });
      evidenceIds.length = 0;
      evidenceIds.push(...work.evidenceIds);
      row = requireFresh(runId);

      if (isCancelled(runId) || abort.signal.aborted) {
        finalizeCancel(runId);
        return;
      }

      row = requireFresh(runId);
      graph = getGraph(row);
      const liveQuestion = findQuestionNode(graph.nodes as ResearchNode[]);
      if (!liveQuestion || liveQuestion.conclusionStatus === 'pruned') {
        emitLog(runId, '问题节点已剪枝，跳过写回');
        await synthesizeAndComplete(runId);
        return;
      }

      writeBackNodeWork(runId, liveQuestion.id, evidenceIds);
      row = requireFresh(runId);
    } else {
      emitLog(runId, '已有研究支路，跳过问题节点检索，直接调度支路');
      appendProgressEvent(runId, 'unit_finished', {
        headline: '跳过问题节点，进入支路调度',
        payload: { skipQuestion: true },
      });
    }

    // Serial work units for live research nodes (c93 branches + fork children)
    await drainResearchWorkUnits(runId, abort.signal);
    if (isCancelled(runId) || abort.signal.aborted) {
      finalizeCancel(runId);
      return;
    }
    row = requireFresh(runId);

    // Pragmatic M1: after first wave with web, pause for budget confirm when
    // we still have remaining search budget (so continue can resume).
    if (row.allowWeb && row.searchesUsed > 0 && row.searchesUsed < row.maxSearches) {
      await enterConfirm(runId, 'budget');
      return;
    }

    await synthesizeAndComplete(runId);
  } catch (error) {
    if (abort.signal.aborted || isCancelled(runId)) {
      finalizeCancel(runId);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof AppHttpError ? error.code : ErrorCode.INTERNAL_ERROR;
    updateRun(runId, { status: 'failed', errorMessage: message });
    broadcast(runId, 'error', { errorCode: code, message });
    emitStatus(runId, 'failed', message);
  } finally {
    activeLoops.delete(runId);
    clearRunAbortController(runId);
    const latest = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
    if (latest?.llmActivity === 'work_unit') {
      updateRun(runId, { llmActivity: null, activeNodeId: null });
    }
  }
}

function requireFresh(runId: number): RunRow {
  const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
  if (!row) throw new NotFoundError(`Research run ${runId} not found`);
  return row;
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
  abortRunWorkUnit(runId);
  abortAllChatsForRun(runId);
  updateRun(runId, {
    cancelRequested: true,
    llmActivity: null,
    activeNodeId: null,
    checkpoint: writeCheckpoint(row, 'cancel_requested'),
  });
  if (row.status === 'awaiting_confirm' || row.status === 'queued') {
    finalizeCancel(runId);
  }
  // running: loop checks cancelRequested / AbortSignal
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
      // One more work-unit then report (stay under budget)
      const latest = requireRun(notebookId, runId);
      const graph = getGraph(latest);
      const root =
        findQuestionNode(graph.nodes as ResearchNode[]) ??
        (graph.nodes[0] as ResearchNode | undefined);
      if (root && (latest.allowWeb || latest.useNotebookSources)) {
        const abort = ensureRunAbortController(runId);
        try {
          const work = await runNodeWorkUnit({
            runId,
            notebookId,
            node: root,
            topic: latest.topic,
            allowWeb: latest.allowWeb && latest.searchesUsed < latest.maxSearches,
            useNotebookSources: latest.useNotebookSources,
            sourceIds: latest.sourceIds ?? null,
            searchesUsed: latest.searchesUsed,
            maxSearches: latest.maxSearches,
            abortSignal: abort.signal,
          });
          const fresh = getGraph(requireFresh(runId));
          const live =
            findQuestionNode(fresh.nodes as ResearchNode[]) ??
            fresh.nodes.find((n) => n.id === root.id);
          if (live) {
            live.evidenceIds = work.evidenceIds;
            live.summary = work.evidenceIds.length
              ? `已收集 ${work.evidenceIds.length} 条证据`
              : live.summary;
            persistGraph(runId, fresh);
            emitGraphPatch(runId, { nodes: [live] });
          }
        } catch (error) {
          if (error instanceof AppHttpError && error.code === ErrorCode.RESEARCH_BUDGET) {
            emitLog(runId, '继续检索跳过：预算已尽');
          } else {
            emitLog(runId, `继续检索失败：${String(error)}`);
          }
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
      const liveCount = graph.nodes.filter((n) => n.conclusionStatus !== 'pruned').length;
      if (liveCount >= latest.maxNodes) {
        throw new AppHttpError(ErrorCode.RESEARCH_BUDGET, 'Node budget exhausted');
      }
      const conclusion = findConclusionNode(graph.nodes as ResearchNode[]);
      if (!conclusion) {
        throw new AppHttpError(
          ErrorCode.INVALID_REQUEST,
          'Single-sink DAG missing conclusion node',
        );
      }
      const child: ResearchNode = {
        id: newId('node'),
        role: 'research',
        title: `扩展：${branchNodeId}`,
        query: latest.topic,
        conclusionStatus: 'partial',
        phase: 'idle',
        summary: '支路已批准',
        evidenceIds: [],
      };
      const forkEdge: ResearchEdge = {
        id: newId('edge'),
        source: branchNodeId,
        target: child.id,
        kind: 'fork',
      };
      const mergeEdge: ResearchEdge = {
        id: newId('edge'),
        source: child.id,
        target: conclusion.id,
        kind: 'merge',
      };
      graph.nodes.push(child);
      graph.edges.push(forkEdge, mergeEdge);
      persistGraph(runId, graph, {
        checkpoint: writeCheckpoint(latest, 'approve_branch'),
      });
      emitGraphPatch(runId, { nodes: [child], edges: [forkEdge, mergeEdge] });

      // Run work_unit on the new research node before report (serial kernel)
      const abort = ensureRunAbortController(runId);
      try {
        await drainResearchWorkUnits(runId, abort.signal);
      } catch (error) {
        if (error instanceof AppHttpError && error.code === ErrorCode.RESEARCH_BUDGET) {
          emitLog(runId, '支路工作单元跳过：预算已尽');
        } else {
          emitLog(runId, `支路工作单元失败：${String(error)}`);
        }
      }
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
  const now = new Date();
  updateRun(runId, {
    status: 'completed',
    report: report as unknown as typeof row.report,
    reportUpdatedAt: now,
    confirmKind: null,
    confirmBranchNodeId: null,
    llmActivity: null,
    activeNodeId: null,
    checkpoint: writeCheckpoint({ ...row, status: 'completed' }, 'report'),
  });
  // auto_complete revision snapshot
  const revId = newId('rev');
  const graph = getGraph(row);
  db()
    .insert(researchRevisions)
    .values({
      id: revId,
      runId,
      notebookId: row.notebookId,
      label: '自动完成',
      kind: 'auto_complete',
      parentRevisionId: row.activeRevisionId ?? null,
      graph,
      report: report as unknown as ResearchReportJson,
      searchesUsed: row.searchesUsed,
      statusAtSave: 'completed',
    })
    .run();
  updateRun(runId, { activeRevisionId: revId });
  appendProgressEvent(runId, 'revision_created', {
    headline: '自动完成快照',
    payload: { revisionId: revId, kind: 'auto_complete' },
  });
  appendProgressEvent(runId, 'report_canonical_updated', {
    headline: '权威报告已生成',
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

function isPruneProtectedNodeId(nodeId: string, nodes: ResearchNode[] = []): boolean {
  const node = nodes.find((n) => n.id === nodeId);
  return isPruneProtectedNode(node, nodeId);
}

/**
 * Prune closure (r316 / update-research-prune-cascade) — keep in sync with
 * Lab `collectPruneClosure` in apps/web/.../fake/deriveLabState.ts.
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
  const target = graph.nodes.find((n) => n.id === nodeId) as ResearchNode | undefined;
  if (!target) {
    throw new AppHttpError(ErrorCode.NOT_FOUND, `Node ${nodeId} not found`);
  }
  if (isPruneProtectedNode(target, nodeId)) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, `Cannot prune protected node ${nodeId}`);
  }
  const toPrune = collectResearchPruneClosure(
    nodeId,
    graph.nodes as ResearchNode[],
    graph.edges as ResearchEdge[],
  );
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

export function patchNode(
  notebookId: number,
  runId: number,
  nodeId: string,
  body: ResearchNodePatchBody,
): ResearchRun {
  const row = requireRun(notebookId, runId);
  assertLiveMutable(row.status);
  const graph = getGraph(row);
  const node = graph.nodes.find((n) => n.id === nodeId) as ResearchNode | undefined;
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
      content: {
        title,
        text: markdown,
        // 兜底：笔记栏可跳回 Lab 报告页（正式产品导航另案设计）
        researchLab: {
          notebookId,
          runId,
          artifactKind: body.artifact.kind,
        },
      },
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

// ---------------------------------------------------------------------------
// C1 — Node chat (SSE short-lived; proposals only)
// ---------------------------------------------------------------------------

/** Pragmatic stub: text + ActionProposal — never mutates graph. */
function stubNodeChatTurn(
  node: ResearchNode,
  message: string,
): { text: string; proposals: ResearchNodeActionProposal[] } {
  const role = resolveNodeRole(node);
  const lower = message.toLowerCase();
  const proposals: ResearchNodeActionProposal[] = [];
  const push = (
    kind: ResearchNodeActionProposal['kind'],
    label: string,
    rationale: string,
    params?: ResearchNodeActionProposal['params'],
  ) => {
    proposals.push({
      id: newId('ap'),
      kind,
      label,
      rationale,
      status: 'pending',
      params,
    });
  };

  if (role === 'research') {
    if (/prune|剪枝|丢弃|砍掉/u.test(lower)) {
      push('prune_node', '剪枝此节点', '接受后走 POST …/prune（不会在 chat 内自动执行）');
    }
    if (/fork|分叉|扩展|支路/u.test(lower)) {
      push('fork_sibling', '分叉兄弟节点', '接受后走 POST …/fork → confirm', {
        title: `扩展：${node.title}`,
      });
    }
    if (/query|查询|改问|rewrite/u.test(lower)) {
      push('rewrite_query', '改写查询', '接受后走 PATCH …/nodes/:id', {
        query: message.slice(0, 200),
      });
    }
    if (/status|状态|结论/u.test(lower)) {
      push('set_status', '设为 partial', '接受后走 PATCH conclusionStatus', {
        conclusionStatus: 'partial',
      });
    }
  } else if (role === 'question') {
    if (/finish|报告|完成/u.test(lower)) {
      push('confirm_finish', '结束并出报告', '接受后走 POST …/confirm finish_report');
    }
    if (/continue|继续/u.test(lower)) {
      push('confirm_continue', '继续研究', '接受后走 POST …/confirm continue');
    }
    if (/query|改问/u.test(lower)) {
      push('rewrite_query', '改写问题查询', '接受后走 PATCH', { query: message.slice(0, 200) });
    }
  } else {
    if (/report|报告|打开/u.test(lower)) {
      push('open_report', '打开报告', '纯前端导航，不改图');
    }
    if (/finish|完成/u.test(lower)) {
      push('confirm_finish', '结束并出报告', '接受后走 confirm');
    }
    if (/status|状态/u.test(lower)) {
      push('set_status', '设结论状态', '接受后走 PATCH', { conclusionStatus: 'partial' });
    }
  }

  if (proposals.length === 0) {
    // Mild default suggestions by role (still proposals only)
    if (role === 'research') {
      push('fork_sibling', '建议分叉', '可选：接受后走 fork 命令口');
    } else if (role === 'conclusion') {
      push('open_report', '查看报告', '纯前端');
    }
  }

  const text = [
    `关于节点「${node.title}」（${role}）：`,
    message.trim(),
    '',
    proposals.length
      ? `我准备了 ${proposals.length} 个动作提案，请在 UI 确认后才会改图（chat 不会自动剪枝/分叉）。`
      : '暂无结构提案。',
  ].join('\n');

  return { text, proposals };
}

export function createNodeChatSseResponse(
  notebookId: number,
  runId: number,
  nodeId: string,
  body: ResearchNodeChatBody,
  requestSignal?: AbortSignal,
): Response {
  const row = requireRun(notebookId, runId);
  const graph = getGraph(row);
  const node = graph.nodes.find((n) => n.id === nodeId) as ResearchNode | undefined;
  if (!node) {
    throw new AppHttpError(ErrorCode.NOT_FOUND, `Node ${nodeId} not found`);
  }
  if (node.conclusionStatus === 'pruned') {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, `Cannot chat on pruned node ${nodeId}`);
  }

  // Mutual exclusion with work_unit (and other chat)
  if (row.llmActivity === 'work_unit' || activeLoops.has(runId)) {
    throw new AppHttpError(ErrorCode.RESEARCH_INVALID_STATE, '节点仍在研究中，请稍后再试对话');
  }
  if (row.llmActivity === 'node_chat') {
    throw new AppHttpError(ErrorCode.RESEARCH_INVALID_STATE, '该 Run 已有节点对话进行中');
  }

  const sse = (event: string, data: unknown): string =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  const key = chatKey(runId, nodeId);
  const ac = new AbortController();
  chatAbortControllers.set(key, ac);
  const onRequestAbort = () => ac.abort();
  requestSignal?.addEventListener('abort', onRequestAbort);

  updateRun(runId, { llmActivity: 'node_chat', activeNodeId: nodeId });
  appendProgressEvent(runId, 'chat_started', {
    nodeId,
    headline: '节点对话开始',
    payload: { messagePreview: body.message.slice(0, 80) },
  });

  const clearChatMutex = () => {
    const latest = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
    if (latest?.llmActivity === 'node_chat') {
      updateRun(runId, { llmActivity: null, activeNodeId: null });
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const emit = (event: string, data: unknown) => {
        if (closed || ac.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(sse(event, data)));
        } catch {
          closed = true;
        }
      };
      // Bun.serve idleTimeout (default 10s) closes quiet SSE mid-flight. Emit
      // immediately and keep comment heartbeats while waiting on LLM TTFB.
      const heartbeat = setInterval(() => {
        if (closed || ac.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          closed = true;
        }
      }, 8_000);
      try {
        emit('log', { message: 'connected', nodeId });

        if (ac.signal.aborted) {
          appendProgressEvent(runId, 'chat_aborted', { nodeId, headline: '对话已中止' });
          emit('error', { errorCode: ErrorCode.INVALID_REQUEST, message: 'aborted' });
          return;
        }

        const role = resolveNodeRole(node);
        const agent = await createResearchNodeAgent(notebookId);
        let proposals: ResearchNodeActionProposal[] = [];
        let usedAgent = false;

        if (agent) {
          try {
            usedAgent = true;
            const result = await agent.stream({
              prompt: body.message,
              abortSignal: ac.signal,
              options: {
                mode: 'node_chat' as const,
                role,
                nodeId: node.id,
                nodeTitle: node.title,
                nodeQuery: node.query,
                allowWeb: row.allowWeb,
                useNotebookSources: row.useNotebookSources,
                // ToolLoopAgent constructed with loosely typed settings
              } as never,
            });

            for await (const part of result.stream) {
              if (ac.signal.aborted) break;
              if (part.type === 'text-delta') {
                const text = 'text' in part ? String(part.text ?? '') : '';
                if (text) emit('chunk', { text });
              } else if (part.type === 'tool-approval-request') {
                const toolCall = (
                  part as {
                    toolCall?: { toolName?: string; toolCallId?: string; input?: unknown };
                  }
                ).toolCall;
                const proposal = proposalFromStructureToolCall({
                  toolName: toolCall?.toolName ?? '',
                  toolCallId: toolCall?.toolCallId,
                  args: toolCall?.input,
                });
                if (proposal) {
                  proposals.push(proposal);
                  emit('proposal', proposal);
                }
              } else if (part.type === 'tool-call') {
                // Fallback if a Structure tool somehow streams without approval
                const tc = part as {
                  toolName?: string;
                  toolCallId?: string;
                  input?: unknown;
                };
                const proposal = proposalFromStructureToolCall({
                  toolName: tc.toolName ?? '',
                  toolCallId: tc.toolCallId,
                  args: tc.input,
                });
                if (proposal && !proposals.some((p) => p.id === proposal.id)) {
                  proposals.push(proposal);
                  emit('proposal', proposal);
                }
              } else if (part.type === 'error') {
                const message =
                  'error' in part && part.error instanceof Error
                    ? part.error.message
                    : 'Generation error';
                emit('error', { errorCode: ErrorCode.INTERNAL_ERROR, message });
                return;
              }
            }
          } catch (agentError) {
            // Fall back to deterministic stub when model/mock is unavailable
            usedAgent = false;
            if (ac.signal.aborted) throw agentError;
            console.warn('[research] node chat agent failed; using stub:', agentError);
          }
        }

        if (!usedAgent) {
          const turn = stubNodeChatTurn(node, body.message);
          proposals = turn.proposals;
          const chunkSize = 48;
          for (let i = 0; i < turn.text.length; i += chunkSize) {
            if (ac.signal.aborted) {
              appendProgressEvent(runId, 'chat_aborted', { nodeId, headline: '对话已中止' });
              emit('error', { errorCode: ErrorCode.INVALID_REQUEST, message: 'aborted' });
              return;
            }
            emit('chunk', { text: turn.text.slice(i, i + chunkSize) });
            await Bun.sleep(0);
          }
          for (const proposal of proposals) {
            if (ac.signal.aborted) break;
            emit('proposal', proposal);
          }
        }

        if (ac.signal.aborted) {
          appendProgressEvent(runId, 'chat_aborted', { nodeId, headline: '对话已中止' });
          emit('error', { errorCode: ErrorCode.INVALID_REQUEST, message: 'aborted' });
          return;
        }

        emit('done', { proposals });
        appendProgressEvent(runId, 'chat_finished', {
          nodeId,
          headline: '节点对话结束',
          payload: { proposalCount: proposals.length, via: usedAgent ? 'agent' : 'stub' },
        });
      } catch (error) {
        emit('error', {
          errorCode: error instanceof AppHttpError ? error.code : ErrorCode.INTERNAL_ERROR,
          message: String(error),
        });
      } finally {
        clearInterval(heartbeat);
        chatAbortControllers.delete(key);
        requestSignal?.removeEventListener('abort', onRequestAbort);
        clearChatMutex();
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
      ac.abort();
      // Eager mutex release if the client/Bun drops the socket mid-flight.
      clearChatMutex();
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

// ---------------------------------------------------------------------------
// C2 — Progress / revisions / report CoW
// ---------------------------------------------------------------------------

function serializeRevision(row: typeof researchRevisions.$inferSelect): ResearchRevision {
  return {
    id: row.id,
    runId: row.runId,
    notebookId: row.notebookId,
    label: row.label,
    kind: row.kind as ResearchRevision['kind'],
    parentRevisionId: row.parentRevisionId ?? null,
    graph: row.graph as ResearchRevision['graph'],
    report: (row.report as ResearchReport | null) ?? null,
    searchesUsed: row.searchesUsed,
    statusAtSave: row.statusAtSave as ResearchRunStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

export function listProgress(
  notebookId: number,
  runId: number,
  afterSeq = 0,
  limit = 100,
): { items: ResearchProgressEvent[]; nextAfterSeq?: number } {
  requireRun(notebookId, runId);
  const rows = db()
    .select()
    .from(researchProgressEvents)
    .where(and(eq(researchProgressEvents.runId, runId), gt(researchProgressEvents.seq, afterSeq)))
    .orderBy(asc(researchProgressEvents.seq))
    .limit(limit)
    .all();
  const items: ResearchProgressEvent[] = rows.map((r) => ({
    id: r.id,
    runId: r.runId,
    seq: r.seq,
    at: r.at.toISOString(),
    kind: r.kind as ResearchProgressKind,
    nodeId: r.nodeId ?? null,
    headline: r.headline ?? null,
    payload: (r.payload as Record<string, unknown> | null) ?? null,
  }));
  const nextAfterSeq = items.length ? items.at(-1)!.seq : undefined;
  return { items, nextAfterSeq };
}

export function listRevisions(notebookId: number, runId: number): { items: ResearchRevision[] } {
  requireRun(notebookId, runId);
  const rows = db()
    .select()
    .from(researchRevisions)
    .where(eq(researchRevisions.runId, runId))
    .orderBy(desc(researchRevisions.createdAt))
    .all();
  return { items: rows.map(serializeRevision) };
}

export function getRevision(notebookId: number, runId: number, revId: string): ResearchRevision {
  requireRun(notebookId, runId);
  const row = db()
    .select()
    .from(researchRevisions)
    .where(and(eq(researchRevisions.runId, runId), eq(researchRevisions.id, revId)))
    .get();
  if (!row) throw new NotFoundError(`Revision ${revId} not found`);
  return serializeRevision(row);
}

export function createRevision(
  notebookId: number,
  runId: number,
  body: ResearchRevisionCreateBody,
): ResearchRevision {
  const row = requireRun(notebookId, runId);
  const from = body.from ?? 'canonical';
  let report: ResearchReportJson | null = (row.report as ResearchReportJson | null) ?? null;
  if (from === 'working') {
    const edit = db()
      .select()
      .from(researchReportEdits)
      .where(eq(researchReportEdits.runId, runId))
      .get();
    if (!edit) {
      throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'No working report to snapshot');
    }
    report = edit.report;
  }
  const id = newId('rev');
  const inserted = db()
    .insert(researchRevisions)
    .values({
      id,
      runId,
      notebookId,
      label: body.label?.trim() || `保存 ${new Date().toISOString()}`,
      kind: 'user_save',
      parentRevisionId: row.activeRevisionId ?? null,
      graph: getGraph(row),
      report,
      searchesUsed: row.searchesUsed,
      statusAtSave: row.status,
    })
    .returning()
    .get();
  updateRun(runId, { activeRevisionId: id });
  appendProgressEvent(runId, 'revision_created', {
    headline: inserted.label,
    payload: { revisionId: id, kind: 'user_save', from },
  });
  return serializeRevision(inserted);
}

export function restoreRevision(notebookId: number, runId: number, revId: string): ResearchRun {
  const row = requireRun(notebookId, runId);
  if (!isTerminalStatus(row.status)) {
    throw new AppHttpError(
      ErrorCode.RESEARCH_INVALID_STATE,
      'Restore only allowed on terminal runs',
    );
  }
  const rev = db()
    .select()
    .from(researchRevisions)
    .where(and(eq(researchRevisions.runId, runId), eq(researchRevisions.id, revId)))
    .get();
  if (!rev) throw new NotFoundError(`Revision ${revId} not found`);

  const now = new Date();
  updateRun(runId, {
    graph: rev.graph,
    report: rev.report,
    reportUpdatedAt: rev.report ? now : row.reportUpdatedAt,
    activeRevisionId: revId,
  });
  // Discard stale working edit
  db().delete(researchReportEdits).where(eq(researchReportEdits.runId, runId)).run();

  emitGraphPatch(runId, {
    nodes: (rev.graph.nodes ?? []) as ResearchNode[],
    edges: (rev.graph.edges ?? []) as ResearchEdge[],
  });
  appendProgressEvent(runId, 'revision_restored', {
    headline: `恢复 ${rev.label}`,
    payload: { revisionId: revId },
  });
  if (rev.report) {
    broadcast(runId, 'report_ready', { runId });
  }
  return serializeRun(requireRun(notebookId, runId));
}

function assertReportEditable(status: string, hasReport: boolean): void {
  if (status === 'completed') return;
  if ((status === 'failed' || status === 'cancelled') && hasReport) return;
  throw new AppHttpError(
    ErrorCode.RESEARCH_INVALID_STATE,
    `Cannot edit report when status is ${status}`,
  );
}

export function getReportView(notebookId: number, runId: number): ResearchReportView {
  const row = requireRun(notebookId, runId);
  const edit = db()
    .select()
    .from(researchReportEdits)
    .where(eq(researchReportEdits.runId, runId))
    .get();
  const canonical = (row.report as ResearchReport | null) ?? null;
  const working = edit ? (edit.report as ResearchReport) : null;
  return {
    canonical,
    working: working ?? undefined,
    viewing: working ? 'working' : 'canonical',
    reportUpdatedAt: row.reportUpdatedAt?.toISOString() ?? null,
    workingUpdatedAt: edit?.updatedAt.toISOString() ?? null,
  };
}

export function putCanonicalReport(
  notebookId: number,
  runId: number,
  report: ResearchReport,
): ResearchReportView {
  const row = requireRun(notebookId, runId);
  assertReportEditable(row.status, Boolean(row.report));
  const now = new Date();
  updateRun(runId, {
    report: report as unknown as ResearchReportJson,
    reportUpdatedAt: now,
  });
  appendProgressEvent(runId, 'report_canonical_updated', { headline: '权威报告已更新' });
  broadcast(runId, 'report_ready', { runId });
  return getReportView(notebookId, runId);
}

export function putWorkingReport(
  notebookId: number,
  runId: number,
  report: ResearchReport,
): ResearchReportView {
  const row = requireRun(notebookId, runId);
  assertReportEditable(row.status, Boolean(row.report));
  const existing = db()
    .select()
    .from(researchReportEdits)
    .where(eq(researchReportEdits.runId, runId))
    .get();
  if (existing) {
    db()
      .update(researchReportEdits)
      .set({ report: report as unknown as ResearchReportJson, updatedAt: new Date() })
      .where(eq(researchReportEdits.runId, runId))
      .run();
  } else {
    db()
      .insert(researchReportEdits)
      .values({
        runId,
        baseReportUpdatedAt: row.reportUpdatedAt ?? null,
        report: report as unknown as ResearchReportJson,
      })
      .run();
  }
  appendProgressEvent(runId, 'report_working_updated', { headline: 'working 报告已更新' });
  return getReportView(notebookId, runId);
}

export function deleteWorkingReport(notebookId: number, runId: number): ResearchReportView {
  requireRun(notebookId, runId);
  db().delete(researchReportEdits).where(eq(researchReportEdits.runId, runId)).run();
  appendProgressEvent(runId, 'report_working_discarded', { headline: '已丢弃 working 报告' });
  return getReportView(notebookId, runId);
}
