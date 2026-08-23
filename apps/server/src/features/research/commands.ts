/**
 * Deep Research HTTP command surface — create/list/get/cancel/confirm/prune/fork/patch/convert + SSE.
 */
import type {
  ResearchConfirmBody,
  ResearchCreateBody,
  ResearchDepth,
  ResearchEdge,
  ResearchNode,
  ResearchRequestReexpandBody,
  ResearchRun,
  ResearchRunStatus,
  ResearchRunSummary,
} from '@crystalith/shared';
import { RESEARCH_DEPTH_BUDGETS } from '@crystalith/shared';
import { and, count, desc, eq, inArray } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { researchProgressEvents, researchRuns } from '../../db/schema.ts';
import { getPageRatio, getSearchAddOnSettings } from '../../shared/config.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { applyDecomposePlanToGraph, planTopicDecomposition } from './decompose.ts';
import { synthesizeAndComplete } from './report.ts';
import { computeMaxPageFetches, computeSearchAddOnK } from './research-budget.ts';
import {
  abortAllChatsForRun,
  abortRunWorkUnit,
  appendProgressEvent,
  CONFIRM_OPTIONS,
  broadcast,
  emptyGraph,
  emitGraphPatch,
  emitLog,
  emitStatus,
  ensureRunAbortController,
  findConclusionNode,
  finalizeCancel,
  getGraph,
  isTerminalStatus,
  newId,
  persistGraph,
  requireFresh,
  requireNotebook,
  requireRun,
  serializeRun,
  serializeRunSummary,
  updateRun,
  writeCheckpoint,
  type RunRow,
} from './research-core.ts';
import { orderResearchNodesForWork } from './research-work-queue.ts';
import {
  drainResearchWorkUnits,
  finishWaveOrSynthesize,
  scheduleRun,
  writeBackNodeWork,
} from './run-loop.ts';

/** Raise maxSearches by formula K; does NOT touch maxNodes / maxPageFetches (c108). */
export function applySearchBudgetAddOn(runId: number): { k: number; maxSearches: number } {
  const row = requireFresh(runId);
  const { addOnRatio, addOnMinK, addOnMaxK } = getSearchAddOnSettings();
  const k = computeSearchAddOnK(row.maxSearches, addOnRatio, addOnMinK, addOnMaxK);
  const maxSearches = row.maxSearches + k;
  updateRun(runId, { maxSearches });
  emitLog(runId, `检索预算加购 +${k} → maxSearches=${maxSearches}`);
  appendProgressEvent(runId, 'budget_tick', {
    headline: `检索预算加购 +${k}`,
    payload: { k, maxSearches, maxNodes: row.maxNodes },
  });
  return { k, maxSearches };
}

/** Mark unfinished research nodes missing before partial-completion synthesize. */
function markUnfinishedResearchMissing(runId: number): void {
  const row = requireFresh(runId);
  const graph = getGraph(row);
  const pending = orderResearchNodesForWork(graph.nodes);
  for (const node of pending) {
    writeBackNodeWork(runId, node.id, node.evidenceIds ?? [], {
      // intentionally || — empty summary gets budget message
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing
      summary: node.summary?.trim() || '预算用尽，未完成检索',
      conclusionStatus: 'missing',
    });
  }
}

export function validateCreateBody(body: ResearchCreateBody): {
  topic: string;
  useNotebookSources: boolean;
  allowWeb: boolean;
  sourceIds: number[] | null;
  depth: ResearchDepth;
  maxSearches: number;
  maxNodes: number;
  modelId: string | null;
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
  // intentionally || — empty trim becomes null
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing
  const modelId = body.modelId?.trim() || null;
  return {
    topic,
    useNotebookSources,
    allowWeb,
    sourceIds,
    depth,
    maxSearches: budget.maxSearches,
    maxNodes: budget.maxNodes,
    modelId,
  };
}

export function createRun(notebookId: number, body: ResearchCreateBody): ResearchRun {
  requireNotebook(notebookId);
  const fields = validateCreateBody(body);
  const maxPageFetches = computeMaxPageFetches(fields.maxSearches, getPageRatio());
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
      maxPageFetches,
      pagesUsed: 0,
      modelId: fields.modelId,
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

/** POST …/schedule — start kernel for a queued Run only (c105 / r335 Lab 续跑). */
export function scheduleQueuedRun(notebookId: number, runId: number): ResearchRun {
  const row = requireRun(notebookId, runId);
  if (row.status !== 'queued') {
    throw new AppHttpError(
      ErrorCode.RESEARCH_INVALID_STATE,
      `Cannot schedule run in status ${row.status}`,
    );
  }
  scheduleRun(runId);
  return serializeRun(requireRun(notebookId, runId));
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
    await confirmBudgetRun(notebookId, runId, body);
  } else if (kind === 'reexpand') {
    await confirmReexpandRun(notebookId, runId, row, body);
  } else {
    await confirmExpandBranchRun(notebookId, runId, row, body);
  }
  return serializeRun(requireRun(notebookId, runId));
}

/** budget 确认：加购继续（c108）或预算触顶后出报告。 */
async function confirmBudgetRun(
  notebookId: number,
  runId: number,
  body: ResearchConfirmBody,
): Promise<void> {
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
  appendProgressEvent(runId, 'confirm_resolved', {
    headline: body.action === 'continue' ? '已加购并继续研究' : '预算触顶后出报告',
    payload: { action: body.action, confirmKind: 'budget' },
  });
  if (body.action !== 'continue') {
    markUnfinishedResearchMissing(runId);
    await synthesizeAndComplete(runId);
    return;
  }
  // c108: raise maxSearches by K and resume drain (NOT fake one-unit then synthesize).
  applySearchBudgetAddOn(runId);
  scheduleRun(runId);
}

/** reexpand 确认：批准后 planner → graph_patch → drain；跳过或规划失败诚实结案。 */
async function confirmReexpandRun(
  notebookId: number,
  runId: number,
  row: RunRow,
  body: ResearchConfirmBody,
): Promise<void> {
  if (body.action !== 'approve_reexpand' && body.action !== 'skip_reexpand') {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      'reexpand confirm requires approve_reexpand or skip_reexpand',
    );
  }
  const focusNodeId = body.branchNodeId ?? row.confirmBranchNodeId ?? undefined;
  const hint = readLatestReexpandHint(runId);
  updateRun(runId, {
    status: 'running',
    confirmKind: null,
    confirmBranchNodeId: null,
    llmActivity: 'work_unit',
  });
  emitStatus(runId, 'running', body.action);
  appendProgressEvent(runId, 'confirm_resolved', {
    headline: body.action === 'approve_reexpand' ? '已批准再扩展' : '已跳过再扩展',
    payload: { action: body.action, focusNodeId: focusNodeId ?? null },
  });

  if (body.action === 'skip_reexpand') {
    // Locked simplest: clear confirm → synthesize.
    // Fresh AbortController: request-reexpand aborts the prior work-unit signal;
    // do not let a stale aborted controller poison synthesize / later schedule.
    ensureRunAbortController(runId);
    await synthesizeAndComplete(runId);
    return;
  }

  // approve_reexpand: planner → graph_patch → drain → budget/synthesize
  const latest = requireRun(notebookId, runId);
  const graph = getGraph(latest);
  const occupied = graph.nodes.filter((n) => n.conclusionStatus !== 'pruned').length;
  const abort = ensureRunAbortController(runId);
  try {
    const plan = await planTopicDecomposition({
      topic: latest.topic,
      depth: latest.depth ?? 'medium',
      maxNodes: latest.maxNodes,
      occupiedNodes: occupied,
      hint: hint ?? undefined,
      abortSignal: abort.signal,
    });
    if (!plan || plan.branches.length === 0) {
      await abortReexpandToSynthesize(runId, '再扩展规划为空或失败，不伪造支路', {
        reason: 'empty_or_null_plan',
      });
      return;
    }
    const applied = applyDecomposePlanToGraph(graph, plan, newId, {
      focusNodeId: focusNodeId,
    });
    if (applied.addedNodes.length === 0) {
      await abortReexpandToSynthesize(runId, '再扩展未写入节点，不伪造支路');
      return;
    }
    persistGraph(runId, applied.graph, {
      checkpoint: writeCheckpoint(latest, 'approve_reexpand'),
    });
    emitGraphPatch(runId, {
      nodes: applied.addedNodes,
      edges: applied.addedEdges,
    });
    appendProgressEvent(runId, 'graph_patched_summary', {
      headline: `再扩展新增 ${applied.addedNodes.length} 个研究支路`,
      payload: { researchNodes: applied.addedNodes.length },
    });
    emitLog(runId, `再扩展新增 ${applied.addedNodes.length} 个研究支路`);
    await finishWaveOrSynthesize(runId);
  } catch (error) {
    await abortReexpandToSynthesize(
      runId,
      '再扩展规划失败，不伪造支路',
      {
        error: String(error),
      },
      `再扩展失败：${String(error)}`,
    );
  }
}

/** reexpand 三胞胎兜底出口：记录 unit_aborted + 日志后诚实结案（不伪造支路）。 */
async function abortReexpandToSynthesize(
  runId: number,
  headline: string,
  payload?: Record<string, unknown>,
  logMessage?: string,
): Promise<void> {
  appendProgressEvent(runId, 'unit_aborted', { headline, payload });
  emitLog(runId, logMessage ?? headline);
  await synthesizeAndComplete(runId);
}

/** expand_branch 确认：批准后 fork 新支路并串行跑工作单元，随后结案。 */
async function confirmExpandBranchRun(
  notebookId: number,
  runId: number,
  row: RunRow,
  body: ResearchConfirmBody,
): Promise<void> {
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
  if (body.action !== 'approve_branch') {
    await synthesizeAndComplete(runId);
    return;
  }

  const latest = requireRun(notebookId, runId);
  const graph = getGraph(latest);
  const liveCount = graph.nodes.filter((n) => n.conclusionStatus !== 'pruned').length;
  if (liveCount >= latest.maxNodes) {
    throw new AppHttpError(ErrorCode.RESEARCH_BUDGET, 'Node budget exhausted');
  }
  const conclusion = findConclusionNode(graph.nodes);
  if (!conclusion) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Single-sink DAG missing conclusion node');
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
  await synthesizeAndComplete(runId);
}

/**
 * c108 / r343: proactive search budget add-on (same K as budget continue).
 * Allowed when running or awaiting_confirm(budget). Does not raise maxNodes / maxPageFetches.
 */
export function addBudget(notebookId: number, runId: number): ResearchRun {
  const row = requireRun(notebookId, runId);
  const isRunning = row.status === 'running';
  const isBudgetConfirm =
    row.status === 'awaiting_confirm' && (row.confirmKind ?? 'budget') === 'budget';
  if (!isRunning && !isBudgetConfirm) {
    throw new AppHttpError(
      ErrorCode.RESEARCH_INVALID_STATE,
      `add-budget only allowed when running or awaiting_confirm(budget); got ${row.status}`,
    );
  }
  applySearchBudgetAddOn(runId);
  if (isBudgetConfirm) {
    updateRun(runId, {
      status: 'running',
      confirmKind: null,
      confirmBranchNodeId: null,
    });
    emitStatus(runId, 'running', 'add_budget');
    appendProgressEvent(runId, 'confirm_resolved', {
      headline: '已加购并继续研究',
      payload: { action: 'add_budget', confirmKind: 'budget' },
    });
    scheduleRun(runId);
  }
  return serializeRun(requireRun(notebookId, runId));
}

/** Read hint stored by requestReexpand in the latest confirm_entered progress payload. */
function readLatestReexpandHint(runId: number): string | null {
  const rows = db()
    .select()
    .from(researchProgressEvents)
    .where(eq(researchProgressEvents.runId, runId))
    .orderBy(desc(researchProgressEvents.seq))
    .limit(40)
    .all();
  for (const pe of rows) {
    if (pe.kind !== 'confirm_entered') continue;
    const payload = pe.payload;
    if (!payload || payload.confirmKind !== 'reexpand') continue;
    const hint = payload.hint;
    return typeof hint === 'string' && hint.trim() ? hint.trim() : null;
  }
  return null;
}

/**
 * c104 / r334: user-gated re-expand → awaiting_confirm + confirmKind=reexpand.
 * Allowed while running or awaiting_confirm; terminal statuses rejected.
 */
export function requestReexpand(
  notebookId: number,
  runId: number,
  body: ResearchRequestReexpandBody = {},
): ResearchRun {
  const row = requireRun(notebookId, runId);
  if (isTerminalStatus(row.status)) {
    throw new AppHttpError(
      ErrorCode.RESEARCH_INVALID_STATE,
      `Cannot request reexpand when status is ${row.status}`,
    );
  }
  if (row.status !== 'running' && row.status !== 'awaiting_confirm') {
    throw new AppHttpError(
      ErrorCode.RESEARCH_INVALID_STATE,
      `Cannot request reexpand when status is ${row.status}`,
    );
  }

  // intentionally || — empty trim becomes null
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing
  const focusNodeId = body.focusNodeId?.trim() || null;
  if (focusNodeId) {
    const graph = getGraph(row);
    if (!graph.nodes.some((n) => n.id === focusNodeId && n.conclusionStatus !== 'pruned')) {
      throw new AppHttpError(ErrorCode.NOT_FOUND, `Focus node ${focusNodeId} not found`);
    }
  }

  // Cooperative pause: flip status before abort so runLoop does not finalizeCancel.
  // running additionally clears LLM occupancy and aborts the in-flight work unit;
  // awaiting_confirm already has llmActivity / activeNodeId cleared.
  const wasRunning = row.status === 'running';
  updateRun(runId, {
    status: 'awaiting_confirm',
    confirmKind: 'reexpand',
    confirmBranchNodeId: focusNodeId,
    ...(wasRunning && { llmActivity: null, activeNodeId: null }),
    checkpoint: writeCheckpoint(row, 'before_confirm_reexpand'),
  });
  if (wasRunning) abortRunWorkUnit(runId);

  // intentionally || — empty trim becomes null
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing
  const hint = body.hint?.trim() || null;
  appendProgressEvent(runId, 'confirm_entered', {
    nodeId: focusNodeId,
    headline: '等待确认再扩展',
    payload: {
      confirmKind: 'reexpand',
      hint,
      focusNodeId,
    },
  });
  emitStatus(runId, 'awaiting_confirm', 'reexpand');
  emitLog(runId, `请求再扩展${hint ? `：${hint}` : ''}`);
  broadcast(runId, 'confirm', {
    kind: 'reexpand',
    branchNodeId: focusNodeId ?? undefined,
    options: CONFIRM_OPTIONS.reexpand,
  });
  return serializeRun(requireRun(notebookId, runId));
}

// --- Facade re-exports: implementations split into single-concern modules (B1) ---
export {
  isPruneProtectedNodeId,
  collectResearchPruneClosure,
  pruneNode,
  patchNode,
  forkNode,
} from './node-actions.ts';
export { convertToNote, convertToSource } from './convert.ts';
export { streamRun, createResearchSseResponse } from './run-sse.ts';
