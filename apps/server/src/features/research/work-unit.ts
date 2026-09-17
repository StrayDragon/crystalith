/**
 * Research work-unit execution: ToolLoopAgent node runs, evidence ingest,
 * and node write-back. Orchestration lives in run-loop.ts.
 */
import type { ResearchNode } from '@crystalith/shared';
import { generateText } from 'ai';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { countTokens, truncateToTokens } from '../../ai/tokenizer.ts';
import {
  getDefaultChatModel,
  getModelById,
  getNodeContentTokenBudget,
  getNodeSummaryTokenBudget,
} from '../../shared/config.ts';
import { logger } from '../../shared/logger.ts';
import { e2eStubNodeSummary, e2eStubWebHits, isResearchE2eStub } from './e2e-stub.ts';
import { createResearchNodeAgent } from './node-agent.ts';
import { computePageSoftCap, computeSearchSoftCap } from './research-budget.ts';
import {
  appendProgressEvent,
  emitGraphPatch,
  emitLog,
  getGraph,
  insertEvidence,
  isCancelled,
  listEvidences,
  persistGraph,
  requireFresh,
  resolveNodeRole,
  updateRun,
  upsertWebEvidenceContent,
  writeCheckpoint,
} from './research-core.ts';
import { resolveNodeRoleForWork } from './research-work-queue.ts';
import { withRunLlmLock, withRunWriteLock } from './run-locks.ts';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Evidence snippet preview length when storing SERP hits (v1 parity). */
const SNIPPET_PREVIEW_CHARS = 500;

/**
 * Mutable per-unit accumulators shared between the agent tool-loop stream and
 * the module-level ingest flush below. `evidenceIds` is shared by reference.
 */
interface WorkUnitStreamState {
  pendingIngest: { toolName: string; output: unknown } | null;
  evidenceIds: string[];
  searchesUsed: number;
  nodeSearchesUsed: number;
  nodePagesUsed: number;
}

/** Remaining token budget for web evidence content on a node (c107). */
function remainingNodeContentBudget(runId: number, nodeId: string): number {
  const budget = getNodeContentTokenBudget();
  const used = listEvidences(runId)
    .filter((e) => e.kind === 'web' && e.collectedAtNodeId === nodeId && e.content)
    .reduce((sum, e) => sum + countTokens(e.content ?? ''), 0);
  return Math.max(0, budget - used);
}

/**
 * Apply the latest pending Work-tool output (budget-aware, emits progress log).
 * Called under the run write lock from the stream consumer.
 */
function flushPendingWorkIngest(
  runId: number,
  notebookId: number,
  nodeId: string,
  state: WorkUnitStreamState,
): void {
  const pending = state.pendingIngest;
  if (!pending) return;
  state.pendingIngest = null;
  const { toolName, output } = pending;
  const contentBudgetRemaining = remainingNodeContentBudget(runId, nodeId);
  const ingested = ingestWorkToolResult(runId, notebookId, nodeId, toolName, output, {
    contentTokenBudgetRemaining: contentBudgetRemaining,
  });
  for (const id of ingested.evidenceIds) {
    if (!state.evidenceIds.includes(id)) state.evidenceIds.push(id);
  }
  if (ingested.searchesDelta > 0) {
    const fresh = requireFresh(runId);
    state.searchesUsed = fresh.searchesUsed + ingested.searchesDelta;
    state.nodeSearchesUsed += ingested.searchesDelta;
    updateRun(runId, { searchesUsed: state.searchesUsed });
  }
  if (ingested.pagesDelta > 0) {
    const fresh = requireFresh(runId);
    const pagesUsed = fresh.pagesUsed + ingested.pagesDelta;
    state.nodePagesUsed += ingested.pagesDelta;
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
        title:
          typeof item.title === 'string'
            ? item.title
            : typeof item.url === 'string'
              ? item.url
              : 'web',
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
        snippet: text.slice(0, SNIPPET_PREVIEW_CHARS),
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
    logger.warn('[research] node short synthesis failed:', error);
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
    const streamState: WorkUnitStreamState = {
      pendingIngest: null,
      evidenceIds,
      searchesUsed,
      nodeSearchesUsed: 0,
      nodePagesUsed: 0,
    };
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

        for await (const part of result.stream) {
          if (abortSignal.aborted || isCancelled(runId)) break;
          if (part.type === 'tool-result') {
            const toolName = 'toolName' in part ? part.toolName : '';
            const output: unknown = 'output' in part ? part.output : undefined;
            if (toolName === 'webSearch') {
              const freshBudget = requireFresh(runId);
              if (
                freshBudget.searchesUsed >= maxSearches ||
                streamState.nodeSearchesUsed >= searchSoft
              ) {
                emitLog(
                  runId,
                  streamState.nodeSearchesUsed >= searchSoft
                    ? '外网检索跳过：本节点搜索软上限已尽'
                    : '外网检索跳过：搜索预算已尽',
                );
                break;
              }
            }
            if (toolName === 'fetchPage') {
              const freshPages = requireFresh(runId);
              if (
                freshPages.pagesUsed >= freshPages.maxPageFetches ||
                streamState.nodePagesUsed >= pageSoft
              ) {
                emitLog(runId, '读页跳过：页面预算或节点软上限已尽（不触发 budget confirm）');
                continue;
              }
            }
            streamState.pendingIngest = { toolName, output };
            await withRunWriteLock(runId, () =>
              flushPendingWorkIngest(runId, notebookId, node.id, streamState),
            );
          } else if (part.type === 'error') {
            throw new Error(
              'error' in part && part.error instanceof Error
                ? part.error.message
                : 'work_unit generation error',
            );
          }
        }
      });
      searchesUsed = streamState.searchesUsed;
      nodePagesUsed = streamState.nodePagesUsed;
      via = 'agent';
    } catch (error) {
      if (abortSignal.aborted || isCancelled(runId)) throw error;
      logger.warn('[research] work_unit agent failed (no fake-hit fallback):', error);
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
