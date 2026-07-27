/**
 * Deep Research run loop — schedule, drain work units, confirm helpers.
 */
import type { ResearchDepth, ResearchNode } from '@crystalith/shared';
import { eq } from 'drizzle-orm';

import { searchWeb } from '../../ai/tools/web-search.ts';
import { db } from '../../db/index.ts';
import { researchRuns } from '../../db/schema.ts';
import { ragRegistry } from '../../rag/registry.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { applyDecomposePlanToGraph, planTopicDecomposition } from './decompose.ts';
import { createResearchNodeAgent } from './node-agent.ts';
import { synthesizeAndComplete } from './report.ts';
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
  newId,
  persistGraph,
  requireFresh,
  resolveNodeRole,
  seedSingleSinkGraph,
  updateRun,
  writeCheckpoint,
} from './research-core.ts';
import { hasLiveResearchBranches, orderResearchNodesForWork } from './research-work-queue.ts';

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

/** Apply a Work tool result into research_evidences; returns new evidence ids + search delta. */
export function ingestWorkToolResult(
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
              // Soft-stop: do not fail the whole Run; caller may enter budget confirm.
              emitLog(runId, '外网检索跳过：搜索预算已尽');
              break;
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
        emitLog(runId, '外网检索跳过：搜索预算已尽');
      } else {
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
          emitLog(runId, `外网检索失败：${String(error)}`);
        }
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

export function patchNodePhase(
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
export function writeBackNodeWork(
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
export async function drainResearchWorkUnits(
  runId: number,
  abortSignal: AbortSignal,
): Promise<void> {
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
          await enterConfirm(runId, 'budget');
          return;
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
    try {
      await drainResearchWorkUnits(runId, abort.signal);
    } catch (error) {
      if (error instanceof AppHttpError && error.code === ErrorCode.RESEARCH_BUDGET) {
        emitLog(runId, '搜索预算已尽，进入预算确认');
        await enterConfirm(runId, 'budget');
        return;
      }
      throw error;
    }
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
    // Fully exhausted after work → still pause so user can finish_report
    if (row.allowWeb && row.searchesUsed >= row.maxSearches) {
      await enterConfirm(runId, 'budget');
      return;
    }

    await synthesizeAndComplete(runId);
  } catch (error) {
    if (abort.signal.aborted || isCancelled(runId)) {
      finalizeCancel(runId);
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
