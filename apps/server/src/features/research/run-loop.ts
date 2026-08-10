/**
 * Deep Research run loop — schedule, drain work units, confirm helpers.
 */
import type { ResearchNode } from '@crystalith/shared';
import { generateText } from 'ai';
import { eq } from 'drizzle-orm';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { countTokens, truncateToTokens } from '../../ai/tokenizer.ts';
import { db } from '../../db/index.ts';
import { researchRuns } from '../../db/schema.ts';
import {
  getDefaultChatModel,
  getModelById,
  getNodeContentTokenBudget,
  getNodeSummaryTokenBudget,
  getParallelBranchUnits,
} from '../../shared/config.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { applyDecomposePlanToGraph, planTopicDecomposition } from './decompose.ts';
import { e2eStubNodeSummary, e2eStubWebHits, isResearchE2eStub } from './e2e-stub.ts';
import { createResearchNodeAgent } from './node-agent.ts';
import { synthesizeAndComplete } from './report.ts';
import { computePageSoftCap, computeSearchSoftCap } from './research-budget.ts';
import {
  activeLoops,
  appendProgressEvent,
  broadcast,
  clearRunAbortController,
  emitGraphPatch,
  emitLog,
  emitStatus,
  ensureRunAbortController,
  findConclusionNode,
  findQuestionNode,
  finalizeCancel,
  getGraph,
  insertEvidence,
  isCancelled,
  listEvidences,
  newId,
  persistGraph,
  requireFresh,
  resolveNodeRole,
  seedSingleSinkGraph,
  updateRun,
  upsertWebEvidenceContent,
  writeCheckpoint,
} from './research-core.ts';
import {
  hasLiveResearchBranches,
  orderResearchNodesForWork,
  resolveNodeRoleForWork,
} from './research-work-queue.ts';
import { withRunLlmLock, withRunWriteLock } from './run-locks.ts';

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

/** Sleep that resolves early when AbortSignal fires (cooperative reexpand pause). */
function sleepUnlessAborted(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return Promise.race([
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    }),
    new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve(), { once: true });
    }),
  ]);
}

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
  if (abort.signal.aborted || isCancelled(runId)) {
    if (shouldFinalizeCancelOnAbort(runId)) finalizeCancel(runId);
    return;
  }
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Remaining token budget for web evidence content on a node (c107). */
function remainingNodeContentBudget(runId: number, nodeId: string): number {
  const budget = getNodeContentTokenBudget();
  const used = listEvidences(runId)
    .filter((e) => e.kind === 'web' && e.collectedAtNodeId === nodeId && e.content)
    .reduce((sum, e) => sum + countTokens(e.content ?? ''), 0);
  return Math.max(0, budget - used);
}

/** Apply a Work tool result into research_evidences; returns new evidence ids + deltas. */
export function ingestWorkToolResult(
  runId: number,
  notebookId: number,
  nodeId: string,
  toolName: string,
  output: unknown,
  opts?: { contentTokenBudgetRemaining?: number },
): { evidenceIds: string[]; searchesDelta: number; pagesDelta: number } {
  const evidenceIds: string[] = [];
  let searchesDelta = 0;
  let pagesDelta = 0;
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
  } else if (toolName === 'fetchPage' && isRecord(output)) {
    const url = typeof output.url === 'string' ? output.url : '';
    if (output.ok === true && url && typeof output.content === 'string') {
      const budget = opts?.contentTokenBudgetRemaining ?? getNodeContentTokenBudget();
      const truncated = budget <= 0 ? '' : truncateToTokens(output.content, Math.max(0, budget));
      if (truncated) {
        const title = typeof output.title === 'string' ? output.title : url;
        const ev = upsertWebEvidenceContent(runId, notebookId, nodeId, url, title, truncated);
        evidenceIds.push(ev.id);
        pagesDelta = 1;
      }
    }
    // Failure / empty: keep SERP snippet; pagesDelta stays 0.
  }
  return { evidenceIds, searchesDelta, pagesDelta };
}

async function shortSynthesizeNodeSummary(opts: {
  runId: number;
  node: ResearchNode;
  topic: string;
  evidenceIds: string[];
  modelId: string | null | undefined;
  abortSignal: AbortSignal;
}): Promise<{ summary: string; conclusionStatus: ResearchNode['conclusionStatus'] }> {
  const { runId, node, topic, evidenceIds, modelId, abortSignal } = opts;
  if (isResearchE2eStub()) {
    const summary = e2eStubNodeSummary(node.title, evidenceIds.length);
    return {
      summary,
      conclusionStatus: evidenceIds.length > 0 ? 'partial' : 'missing',
    };
  }

  const modelConfig = (() => {
    const id = modelId?.trim();
    if (id) return getModelById(id) ?? getDefaultChatModel();
    return getDefaultChatModel();
  })();
  if (!modelConfig) {
    emitLog(runId, `节点 ${node.id} 短综合跳过：无可用模型`);
    return {
      summary: evidenceIds.length ? `已收集 ${evidenceIds.length} 条证据` : '未收集到证据',
      conclusionStatus: 'missing',
    };
  }

  const evidenceLinesRaw = listEvidences(runId)
    .filter((e) => evidenceIds.includes(e.id))
    .map((e) => {
      if (e.content?.trim()) {
        return `- [正文] ${e.title}${e.url ? ` (${e.url})` : ''}：\n${e.content}`;
      }
      if (e.snippet?.trim()) {
        return `- [摘要] ${e.title}${e.url ? ` (${e.url})` : ''}：${e.snippet}`;
      }
      return `- ${e.title}`;
    })
    .join('\n');
  const evidenceLines = truncateToTokens(evidenceLinesRaw, getNodeSummaryTokenBudget());

  try {
    const model = withRetry(await resolveModel(modelConfig));
    const { text } = await withRunLlmLock(runId, () =>
      generateText({
        model,
        abortSignal,
        maxOutputTokens: modelConfig.completionOptions?.maxTokens ?? 512,
        temperature: modelConfig.completionOptions?.temperature ?? 0.2,
        prompt: [
          '请用一两句中文总结本节点的研究发现（短综合）。',
          `研究主题：${topic}`,
          `节点：${node.title}`,
          node.query ? `查询：${node.query}` : '',
          evidenceIds.length === 0
            ? '证据：无。请诚实说明检索无命中，不要编造来源。'
            : `证据：\n${evidenceLines}`,
          '不要输出 JSON；只要纯文本摘要。',
        ]
          .filter(Boolean)
          .join('\n'),
      }),
    );
    const summary = text.trim();
    if (!summary) {
      return {
        summary: evidenceIds.length ? `已收集 ${evidenceIds.length} 条证据` : '未收集到证据',
        conclusionStatus: 'missing',
      };
    }
    return {
      summary,
      conclusionStatus: evidenceIds.length > 0 ? 'partial' : 'missing',
    };
  } catch (error) {
    if (abortSignal.aborted || isCancelled(runId)) throw error;
    console.warn('[research] node short synthesis failed:', error);
    emitLog(runId, `节点 ${node.id} 短综合失败：${String(error)}`);
    return {
      summary: evidenceIds.length ? `已收集 ${evidenceIds.length} 条证据（综合失败）` : '综合失败',
      conclusionStatus: 'missing',
    };
  }
}

/**
 * Node work-unit via ToolLoopAgent (mode=work_unit) + LLM short synthesis.
 * Empty tool results are legal; MUST NOT pragmatic fake-hit fallback.
 */
export async function runNodeWorkUnit(opts: {
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
}): Promise<{
  evidenceIds: string[];
  searchesUsed: number;
  via: 'agent' | 'none';
  summary: string;
  conclusionStatus: ResearchNode['conclusionStatus'];
}> {
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
  let nodePagesUsed = 0;
  let nodeSearchesUsed = 0;
  const evidenceIds: string[] = [...(node.evidenceIds ?? [])];
  const role = resolveNodeRole(node);

  const runAtStart = requireFresh(runId);
  const remainingPages = Math.max(0, runAtStart.maxPageFetches - runAtStart.pagesUsed);
  const liveResearchCount = getGraph(runAtStart).nodes.filter(
    (n) => resolveNodeRoleForWork(n) === 'research' && n.conclusionStatus !== 'pruned',
  ).length;
  const pageSoft = computePageSoftCap(remainingPages, liveResearchCount);
  const searchesRemaining = Math.max(0, maxSearches - searchesUsed);
  const searchSoft = computeSearchSoftCap(searchesRemaining, liveResearchCount);

  updateRun(runId, { llmActivity: 'work_unit', activeNodeId: node.id });
  appendProgressEvent(runId, 'unit_started', {
    nodeId: node.id,
    headline: `work_unit:${node.id}`,
  });

  // E2E stub: deterministic web hits + searchesUsed bump so M1 budget confirm still fires
  // (c102 removed pragmatic fake-hit; without this, stub runs complete with searchesUsed=0).
  if (isResearchE2eStub()) {
    if (allowWeb && searchesUsed < maxSearches) {
      // intentionally || — empty query falls back to title/topic
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing
      const query = node.query?.trim() || node.title || topic;
      await withRunWriteLock(runId, () => {
        const ingested = ingestWorkToolResult(
          runId,
          notebookId,
          node.id,
          'webSearch',
          e2eStubWebHits(query),
        );
        evidenceIds.push(...ingested.evidenceIds);
        if (ingested.searchesDelta > 0) {
          const fresh = requireFresh(runId);
          searchesUsed = fresh.searchesUsed + ingested.searchesDelta;
          updateRun(runId, { searchesUsed });
        }
      });
      emitLog(runId, `外网检索（e2e stub）：${evidenceIds.length} 条`);
    }
    const synth = await shortSynthesizeNodeSummary({
      runId,
      node,
      topic,
      evidenceIds,
      modelId: requireFresh(runId).modelId,
      abortSignal,
    });
    appendProgressEvent(runId, 'unit_finished', {
      nodeId: node.id,
      headline: 'work_unit done (e2e-stub)',
      payload: {
        evidenceCount: evidenceIds.length,
        via: 'stub',
        conclusionStatus: synth.conclusionStatus,
      },
    });
    return {
      evidenceIds,
      searchesUsed,
      via: 'none',
      summary: synth.summary,
      conclusionStatus: synth.conclusionStatus,
    };
  }

  const agent = await createResearchNodeAgent(notebookId);
  let via: 'agent' | 'none' = 'none';

  if (agent) {
    try {
      // Hold per-run LLM lock for the tool-loop stream; Work tools release the
      // lock during execute so parallel units can overlap search/retrieve IO.
      await withRunLlmLock(runId, async () => {
        const result = await agent.stream({
          prompt: [
            `研究主题：${topic}`,
            `节点：${node.title}`,
            node.query ? `查询：${node.query}` : '',
            `预算：剩余搜索 ${searchesRemaining}；本节点搜索软上限 ${searchSoft}；剩余读页 ${remainingPages}；本节点读页软上限 ${pageSoft}。`,
            '请使用可用工具收集证据：webSearch 后自选 URL 读页（fetchPage）。无命中时保持空列表，不要编造。',
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
            pagesRemaining: remainingPages,
            pageSoft,
            searchesRemaining,
            searchSoft,
          },
        });

        let pendingIngest: { toolName: string; output: unknown } | null = null;
        const flushPendingIngest = () => {
          const pending = pendingIngest;
          if (!pending) return;
          pendingIngest = null;
          const { toolName, output } = pending;
          const contentBudgetRemaining = remainingNodeContentBudget(runId, node.id);
          const ingested = ingestWorkToolResult(runId, notebookId, node.id, toolName, output, {
            contentTokenBudgetRemaining: contentBudgetRemaining,
          });
          for (const id of ingested.evidenceIds) {
            if (!evidenceIds.includes(id)) evidenceIds.push(id);
          }
          if (ingested.searchesDelta > 0) {
            const fresh = requireFresh(runId);
            searchesUsed = fresh.searchesUsed + ingested.searchesDelta;
            nodeSearchesUsed += ingested.searchesDelta;
            updateRun(runId, { searchesUsed });
          }
          if (ingested.pagesDelta > 0) {
            const fresh = requireFresh(runId);
            const pagesUsed = fresh.pagesUsed + ingested.pagesDelta;
            nodePagesUsed += ingested.pagesDelta;
            updateRun(runId, { pagesUsed });
          }
          emitLog(
            runId,
            toolName === 'webSearch'
              ? `外网检索：${ingested.evidenceIds.length} 条`
              : toolName === 'fetchPage'
                ? ingested.pagesDelta > 0
                  ? `读页成功：${ingested.evidenceIds.join(', ')}`
                  : '读页失败或正文为空，保留摘要'
                : toolName === 'retrieveSources'
                  ? `检索笔记本：${ingested.evidenceIds.length} 条`
                  : `工具 ${toolName} 完成`,
          );
        };

        for await (const part of result.stream) {
          if (abortSignal.aborted || isCancelled(runId)) break;
          if (part.type === 'tool-result') {
            const toolName = 'toolName' in part ? String(part.toolName) : '';
            const output = 'output' in part ? part.output : undefined;
            if (toolName === 'webSearch') {
              const freshBudget = requireFresh(runId);
              if (freshBudget.searchesUsed >= maxSearches || nodeSearchesUsed >= searchSoft) {
                emitLog(
                  runId,
                  nodeSearchesUsed >= searchSoft
                    ? '外网检索跳过：本节点搜索软上限已尽'
                    : '外网检索跳过：搜索预算已尽',
                );
                break;
              }
            }
            if (toolName === 'fetchPage') {
              const freshPages = requireFresh(runId);
              if (freshPages.pagesUsed >= freshPages.maxPageFetches || nodePagesUsed >= pageSoft) {
                emitLog(runId, '读页跳过：页面预算或节点软上限已尽（不触发 budget confirm）');
                continue;
              }
            }
            pendingIngest = { toolName, output };
            await withRunWriteLock(runId, flushPendingIngest);
          } else if (part.type === 'error') {
            throw new Error(
              'error' in part && part.error instanceof Error
                ? part.error.message
                : 'work_unit generation error',
            );
          }
        }
      });
      via = 'agent';
    } catch (error) {
      if (abortSignal.aborted || isCancelled(runId)) throw error;
      console.warn('[research] work_unit agent failed (no fake-hit fallback):', error);
      emitLog(runId, `节点 ${node.id} 工具环失败，保留已收集证据继续短综合`);
      via = evidenceIds.length ? 'agent' : 'none';
    }
  } else {
    emitLog(runId, `节点 ${node.id} 无可用模型，跳过工具检索`);
  }

  const fresh = requireFresh(runId);
  const synth = await shortSynthesizeNodeSummary({
    runId,
    node,
    topic,
    evidenceIds,
    modelId: fresh.modelId,
    abortSignal,
  });

  appendProgressEvent(runId, 'unit_finished', {
    nodeId: node.id,
    headline: `work_unit done (${via})`,
    payload: {
      evidenceCount: evidenceIds.length,
      via,
      conclusionStatus: synth.conclusionStatus,
      nodePagesUsed,
    },
  });

  return {
    evidenceIds,
    searchesUsed,
    via,
    summary: synth.summary,
    conclusionStatus: synth.conclusionStatus,
  };
}

export function patchNodePhase(
  runId: number,
  nodeId: string,
  phase: ResearchNode['phase'],
): ResearchNode | null {
  const row = requireFresh(runId);
  const graph = getGraph(row);
  const live = graph.nodes.find((n) => n.id === nodeId);
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
export function writeBackNodeWork(
  runId: number,
  nodeId: string,
  evidenceIds: string[],
  opts?: {
    summary?: string;
    conclusionStatus?: ResearchNode['conclusionStatus'];
  },
): ResearchNode | null {
  const row = requireFresh(runId);
  const graph = getGraph(row);
  const live = graph.nodes.find((n) => n.id === nodeId);
  if (!live || live.conclusionStatus === 'pruned') return null;
  const conclusionStatus =
    opts?.conclusionStatus ?? (evidenceIds.length > 0 ? 'partial' : 'missing');
  const summary =
    opts?.summary ?? (evidenceIds.length ? `已收集 ${evidenceIds.length} 条证据` : '未收集到证据');
  const updated: ResearchNode = {
    ...live,
    phase: 'idle',
    conclusionStatus,
    summary,
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
        console.warn('[research] parallel work-unit rejected:', result.reason);
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

export async function runLoop(runId: number): Promise<void> {
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
      if (shouldFinalizeCancelOnAbort(runId)) finalizeCancel(runId);
      return;
    }

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

    // c93 / r326: auto-decompose topic into research nodes (topology only; c94 runs units).
    // r333: at most once per run — skip when live research branches already exist
    // (user-gated secondary decompose goes through request-reexpand / confirm, not here).
    if (isCancelled(runId) || abort.signal.aborted) {
      if (shouldFinalizeCancelOnAbort(runId)) finalizeCancel(runId);
      return;
    }
    row = requireFresh(runId);
    graph = getGraph(row);
    if (!hasLiveResearchBranches(graph.nodes)) {
      const occupied = graph.nodes.filter((n) => n.conclusionStatus !== 'pruned').length;
      try {
        const plan = await planTopicDecomposition({
          topic: row.topic,
          depth: row.depth ?? 'medium',
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
      emitLog(runId, 'e2e stub: hold 2.5s before drain for live interaction window');
      await sleepUnlessAborted(2500, abort.signal);
      if (abort.signal.aborted || isCancelled(runId)) {
        if (shouldFinalizeCancelOnAbort(runId)) finalizeCancel(runId);
        return;
      }
    }

    // F1=A: live research branches → skip question work-unit; drain branches only.
    // No branches → keep question → drain (fork children / empty decompose fallback).
    row = requireFresh(runId);
    graph = getGraph(row);
    question = findQuestionNode(graph.nodes)!;
    if (question.conclusionStatus === 'pruned') {
      emitLog(runId, `跳过已剪枝节点 ${question.id}`);
      await synthesizeAndComplete(runId);
      return;
    }

    const skipQuestionUnit = hasLiveResearchBranches(graph.nodes);
    if (!skipQuestionUnit) {
      const evidenceIds: string[] = [...(question.evidenceIds ?? [])];

      // Budget gate before spending search (question-only path) — true exhaustion only (c108)
      if (row.allowWeb) {
        if (row.searchesUsed >= row.maxSearches) {
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
        if (shouldFinalizeCancelOnAbort(runId)) finalizeCancel(runId);
        return;
      }

      row = requireFresh(runId);
      graph = getGraph(row);
      const liveQuestion = findQuestionNode(graph.nodes);
      if (!liveQuestion || liveQuestion.conclusionStatus === 'pruned') {
        emitLog(runId, '问题节点已剪枝，跳过写回');
        await synthesizeAndComplete(runId);
        return;
      }

      writeBackNodeWork(runId, liveQuestion.id, evidenceIds, {
        summary: work.summary,
        conclusionStatus: work.conclusionStatus,
      });
      row = requireFresh(runId);
    } else {
      emitLog(runId, '已有研究支路，跳过问题节点检索，直接调度支路');
      appendProgressEvent(runId, 'unit_finished', {
        headline: '跳过问题节点，进入支路调度',
        payload: { skipQuestion: true },
      });
    }

    // Parallel-capable work units for live research nodes (c106; N=1 ≡ serial)
    if (isCancelled(runId) || abort.signal.aborted) {
      if (shouldFinalizeCancelOnAbort(runId)) finalizeCancel(runId);
      return;
    }
    await finishWaveOrSynthesize(runId);
  } catch (error) {
    if (abort.signal.aborted || isCancelled(runId)) {
      if (shouldFinalizeCancelOnAbort(runId)) finalizeCancel(runId);
      return;
    }
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
  const options =
    kind === 'budget'
      ? ['continue', 'finish_report']
      : kind === 'reexpand'
        ? ['approve_reexpand', 'skip_reexpand']
        : ['approve_branch', 'skip_branch'];
  broadcast(runId, 'confirm', {
    kind,
    branchNodeId,
    options,
  });
}
