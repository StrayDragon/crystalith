/**
 * Deep Research run loop — schedule, phases, confirm gates.
 * Work-unit execution (agent tool-loop, evidence ingest, node write-back)
 * lives in work-unit.ts.
 */
import { eq } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { researchRuns } from '../../db/schema.ts';
import { getParallelBranchUnits } from '../../shared/config.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { logger } from '../../shared/logger.ts';
import { applyDecomposePlanToGraph, planTopicDecomposition } from './decompose.ts';
import { isResearchE2eStub } from './e2e-stub.ts';
import { synthesizeAndComplete } from './report.ts';
import {
  activeLoops,
  appendProgressEvent,
  broadcast,
  clearRunAbortController,
  CONFIRM_OPTIONS,
  emitGraphPatch,
  emitLog,
  emitStatus,
  ensureRunAbortController,
  findConclusionNode,
  findQuestionNode,
  finalizeCancel,
  getGraph,
  isCancelled,
  newId,
  persistGraph,
  requireFresh,
  seedSingleSinkGraph,
  updateRun,
  writeCheckpoint,
} from './research-core.ts';
import { hasLiveResearchBranches, orderResearchNodesForWork } from './research-work-queue.ts';
import { withRunWriteLock } from './run-locks.ts';
import { patchNodePhase, runNodeWorkUnit, writeBackNodeWork } from './work-unit.ts';

/** Cooperative pause: awaiting_confirm / reexpand abort must not finalize cancel (c104/c108). */
function shouldFinalizeCancelOnAbort(runId: number): boolean {
  const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
  if (!row) return true;
  // AbortSignal is shared by cancel and cooperative reexpand pause — only user cancel
  // sets cancelRequested. Skipping this check races: skip_reexpand flips status back to
  // running while the aborted runLoop still exits and would finalizeCancel.
  if (!row.cancelRequested) return false;
  return row.status !== 'awaiting_confirm';
}

/**
 * Cancelled-or-aborted checkpoint shared by runLoop / finishWaveOrSynthesize.
 * Returns true when the caller must stop; finalizes user-cancel unless a
 * cooperative pause owns the abort (see shouldFinalizeCancelOnAbort).
 */
function bailIfAborted(runId: number, signal: AbortSignal): boolean {
  if (!signal.aborted && !isCancelled(runId)) return false;
  if (shouldFinalizeCancelOnAbort(runId)) finalizeCancel(runId);
  return true;
}

/** Sleep that resolves early when AbortSignal fires (cooperative reexpand pause). */
function sleepUnlessAborted(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return Promise.race([
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    }),
    new Promise<void>((resolve) => {
      signal.addEventListener(
        'abort',
        () => {
          resolve();
        },
        { once: true },
      );
    }),
  ]);
}

/** c108 e2e: pre-drain hold so Playwright can fork / request-reexpand mid-run. */
const E2E_INTERACTION_WINDOW_MS = 2500;

/** After drain: budget confirm only when truly exhausted and still need search; else synthesize. */
export async function finishWaveOrSynthesize(runId: number): Promise<void> {
  const abort = ensureRunAbortController(runId);
  try {
    await drainResearchWorkUnits(runId, abort.signal);
  } catch (error) {
    if (error instanceof AppHttpError && error.code === ErrorCode.RESEARCH_BUDGET) {
      // User-gated reexpand pause wins over automatic budget confirm (c104).
      const paused = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
      if (paused?.status === 'awaiting_confirm') return;
      emitLog(runId, '搜索预算已尽，进入预算确认');
      await enterConfirm(runId, 'budget');
      return;
    }
    throw error;
  }
  if (bailIfAborted(runId, abort.signal)) return;
  const row = requireFresh(runId);
  // Cooperative pause (request-reexpand) already owns the confirm gate.
  if (row.status === 'awaiting_confirm') return;
  // c108: no mid-wave remaining-budget confirm; only true exhaustion with work left.
  if (row.allowWeb && row.searchesUsed >= row.maxSearches) {
    const pending = orderResearchNodesForWork(getGraph(row).nodes);
    if (pending.length > 0) {
      await enterConfirm(runId, 'budget');
      return;
    }
  }
  await synthesizeAndComplete(runId);
}

/** Schedule async execution (microtask). */
export function scheduleRun(runId: number): void {
  if (activeLoops.has(runId)) return;
  queueMicrotask(() => {
    void runLoop(runId);
  });
}

/** Parallel-capable work units for live research nodes (c106; N=1 ≡ serial). */
export async function drainResearchWorkUnits(
  runId: number,
  abortSignal: AbortSignal,
): Promise<void> {
  const parallelN = getParallelBranchUnits();

  while (!abortSignal.aborted && !isCancelled(runId)) {
    const row = requireFresh(runId);
    const graph = getGraph(row);
    // F2=B: stable insertion-order queue (orderResearchNodesForWork); re-read each wave
    const pending = orderResearchNodesForWork(graph.nodes);
    if (pending.length === 0) return;
    const batch = pending.slice(0, parallelN);

    // F4=A / c108: budget exhausted with work left → hard stop (do NOT mark missing; resume after add-on)
    if (row.allowWeb && row.searchesUsed >= row.maxSearches) {
      throw new AppHttpError(ErrorCode.RESEARCH_BUDGET, 'Search budget exhausted');
    }

    for (const node of batch) {
      await withRunWriteLock(runId, () => {
        patchNodePhase(runId, node.id, 'retrieving');
      });
      appendProgressEvent(runId, 'node_phase', {
        nodeId: node.id,
        headline: 'retrieving',
        payload: { phase: 'retrieving' },
      });
    }

    const settled = await Promise.allSettled(
      batch.map(async (node) => {
        const fresh = requireFresh(runId);
        const work = await runNodeWorkUnit({
          runId,
          notebookId: fresh.notebookId,
          node,
          // intentionally || — empty node query falls back to run topic
          // oxlint-disable-next-line typescript/prefer-nullish-coalescing
          topic: node.query?.trim() || fresh.topic,
          allowWeb: fresh.allowWeb && fresh.searchesUsed < fresh.maxSearches,
          useNotebookSources: fresh.useNotebookSources,
          sourceIds: fresh.sourceIds ?? null,
          searchesUsed: fresh.searchesUsed,
          maxSearches: fresh.maxSearches,
          abortSignal,
        });
        return { node, work };
      }),
    );

    if (abortSignal.aborted || isCancelled(runId)) return;

    for (const result of settled) {
      if (result.status === 'rejected') {
        if (abortSignal.aborted || isCancelled(runId)) return;
        logger.warn('[research] parallel work-unit rejected:', result.reason);
        continue;
      }
      const { node, work } = result.value;
      await withRunWriteLock(runId, () => {
        const written = writeBackNodeWork(runId, node.id, work.evidenceIds, {
          summary: work.summary,
          conclusionStatus: work.conclusionStatus,
        });
        if (!written) {
          emitLog(runId, `研究节点 ${node.id} 已剪枝，跳过写回`);
          appendProgressEvent(runId, 'unit_skipped_pruned', { nodeId: node.id });
        } else {
          appendProgressEvent(runId, 'unit_finished', {
            nodeId: node.id,
            headline: written.summary ?? '支路完成',
            payload: {
              evidenceCount: work.evidenceIds.length,
              conclusionStatus: work.conclusionStatus,
            },
          });
        }
      });
    }
  }
}

/**
 * c93 / r326 / r333: auto-decompose topic into research nodes at most once per
 * run, only when no live research branches exist (topology only; c94 runs
 * units). User-gated secondary decompose goes through request-reexpand /
 * confirm, not here. Returns true when the caller loop must stop (cancelled).
 */
async function maybeAutoDecompose(runId: number, abortSignal: AbortSignal): Promise<boolean> {
  if (bailIfAborted(runId, abortSignal)) return true;
  const row = requireFresh(runId);
  const graph = getGraph(row);
  if (hasLiveResearchBranches(graph.nodes)) return false;
  const occupied = graph.nodes.filter((n) => n.conclusionStatus !== 'pruned').length;
  try {
    const plan = await planTopicDecomposition({
      topic: row.topic,
      depth: row.depth ?? 'medium',
      maxNodes: row.maxNodes,
      occupiedNodes: occupied,
      abortSignal,
    });
    if (plan && plan.branches.length > 0) {
      const applied = applyDecomposePlanToGraph(graph, plan, newId);
      if (applied.addedNodes.length > 0) {
        persistGraph(runId, applied.graph, {
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
  return false;
}

/**
 * F1=A: when live research branches exist, skip the question work-unit and go
 * straight to branch scheduling; otherwise run the question unit and write it
 * back (fork children / empty-decompose fallback path).
 * Returns true when the caller loop must stop (completed / confirmed / cancelled).
 */
async function runQuestionPhaseOrSkip(runId: number, abortSignal: AbortSignal): Promise<boolean> {
  const row = requireFresh(runId);
  const graph = getGraph(row);
  const question = findQuestionNode(graph.nodes)!;
  if (question.conclusionStatus === 'pruned') {
    emitLog(runId, `跳过已剪枝节点 ${question.id}`);
    await synthesizeAndComplete(runId);
    return true;
  }

  if (hasLiveResearchBranches(graph.nodes)) {
    emitLog(runId, '已有研究支路，跳过问题节点检索，直接调度支路');
    appendProgressEvent(runId, 'unit_finished', {
      headline: '跳过问题节点，进入支路调度',
      payload: { skipQuestion: true },
    });
    return false;
  }

  // Budget gate before spending search (question-only path) — true exhaustion only (c108)
  if (row.allowWeb && row.searchesUsed >= row.maxSearches) {
    await enterConfirm(runId, 'budget');
    return true;
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
    abortSignal,
  });

  if (bailIfAborted(runId, abortSignal)) return true;

  const fresh = requireFresh(runId);
  const liveQuestion = findQuestionNode(getGraph(fresh).nodes);
  if (!liveQuestion || liveQuestion.conclusionStatus === 'pruned') {
    emitLog(runId, '问题节点已剪枝，跳过写回');
    await synthesizeAndComplete(runId);
    return true;
  }

  writeBackNodeWork(runId, liveQuestion.id, work.evidenceIds, {
    summary: work.summary,
    conclusionStatus: work.conclusionStatus,
  });
  return false;
}

export async function runLoop(runId: number, chatWaitBudgetMs = 60_000): Promise<void> {
  if (activeLoops.has(runId)) return;
  activeLoops.add(runId);
  const abort = ensureRunAbortController(runId);
  try {
    let row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
    if (!row) return;
    if (row.status !== 'queued' && row.status !== 'running') return;

    // r98: chat 与 work-unit MUST 互斥。节点对话持锁时这里排队等待其释放
    // （chat 是短轮 SSE，流结束/中止时必然释放互斥）；等待超预算则放弃本次
    // 调度而非抢占，Run 保持 queued/running，可再次手动继续。
    const chatWaitStart = Date.now();
    while (row.llmActivity === 'node_chat') {
      if (bailIfAborted(runId, abort.signal)) return;
      if (Date.now() - chatWaitStart >= chatWaitBudgetMs) {
        emitLog(runId, '节点对话长时间占用，研究循环暂缓（可手动继续）');
        return;
      }
      await Bun.sleep(250);
      row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
      if (!row) return;
      if (row.status !== 'queued' && row.status !== 'running') return;
    }

    row = updateRun(runId, { status: 'running', llmActivity: 'work_unit', activeNodeId: null });
    emitStatus(runId, 'running');
    emitLog(runId, `开始研究「${row.topic}」`);
    appendProgressEvent(runId, 'unit_started', { headline: 'work_unit' });

    if (bailIfAborted(runId, abort.signal)) return;

    // Seed single-sink DAG (question + conclusion) at start of loop (r317).
    let graph = getGraph(row);
    let question = findQuestionNode(graph.nodes);
    let conclusion = findConclusionNode(graph.nodes);
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

    if (await maybeAutoDecompose(runId, abort.signal)) return;

    // c108 e2e: mid-wave budget confirm removed — give Playwright a short live
    // window to fork / request-reexpand before stub drain finishes.
    // Abortable sleep: request-reexpand must wake the loop immediately (not wait out the hold).
    row = requireFresh(runId);
    graph = getGraph(row);
    if (
      isResearchE2eStub() &&
      hasLiveResearchBranches(graph.nodes) &&
      !abort.signal.aborted &&
      !isCancelled(runId)
    ) {
      emitLog(
        runId,
        `e2e stub: hold ${E2E_INTERACTION_WINDOW_MS}ms before drain for live interaction window`,
      );
      await sleepUnlessAborted(E2E_INTERACTION_WINDOW_MS, abort.signal);
      if (bailIfAborted(runId, abort.signal)) return;
    }

    // F1=A: live research branches → skip question work-unit; drain branches only.
    // No branches → keep question → drain (fork children / empty decompose fallback).
    if (await runQuestionPhaseOrSkip(runId, abort.signal)) return;

    // Parallel-capable work units for live research nodes (c106; N=1 ≡ serial)
    if (bailIfAborted(runId, abort.signal)) return;
    await finishWaveOrSynthesize(runId);
  } catch (error) {
    if (bailIfAborted(runId, abort.signal)) return;
    if (error instanceof AppHttpError && error.code === ErrorCode.RESEARCH_BUDGET) {
      emitLog(runId, '搜索预算已尽，进入预算确认');
      await enterConfirm(runId, 'budget');
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

export async function enterConfirm(
  runId: number,
  kind: 'budget' | 'expand_branch' | 'reexpand',
  branchNodeId?: string,
): Promise<void> {
  let row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
  if (!row) return;
  // Do not clobber a live user-gated reexpand confirm with automatic budget (c104).
  if (kind === 'budget' && row.status === 'awaiting_confirm' && row.confirmKind === 'reexpand') {
    return;
  }
  row = updateRun(runId, {
    status: 'awaiting_confirm',
    confirmKind: kind,
    confirmBranchNodeId: branchNodeId ?? null,
    llmActivity: null,
    activeNodeId: null,
    checkpoint: writeCheckpoint(row, `before_confirm_${kind}`),
  });
  emitStatus(runId, 'awaiting_confirm', kind);
  broadcast(runId, 'confirm', {
    kind,
    branchNodeId,
    options: CONFIRM_OPTIONS[kind],
  });
}
