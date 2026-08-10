/**
 * Deep Research report synthesis, revisions, and report CoW APIs.
 */
import type {
  ResearchConvertBody,
  ResearchEvidence,
  ResearchNode,
  ResearchProgressEvent,
  ResearchProgressKind,
  ResearchReport,
  ResearchReportView,
  ResearchRetrySynthesizeBody,
  ResearchRun,
} from '@crystalith/shared';
import { ResearchReportSchema } from '@crystalith/shared';
import { generateObject, generateText } from 'ai';
import { and, asc, eq, gt } from 'drizzle-orm';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import {
  researchProgressEvents,
  researchReportEdits,
  researchRevisions,
  researchRuns,
  type ResearchReportJson,
} from '../../db/schema.ts';
import { getDefaultChatModel, getModelById } from '../../shared/config.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { e2eStubResearchReport, isResearchE2eStub } from './e2e-stub.ts';
import {
  isSynthesizeFailureReason,
  repairResearchReportText,
  SYNTHESIZE_FAILED_PREFIX,
  SYNTHESIZE_MODEL_ERROR_PREFIX,
  validateAndBindCitations,
} from './report-citations.ts';
import {
  appendProgressEvent,
  broadcast,
  emitLog,
  emitStatus,
  finalizeCancel,
  getGraph,
  isCancelled,
  listEvidences,
  newId,
  requireRun,
  serializeRun,
  updateRun,
  writeCheckpoint,
  type RunRow,
} from './research-core.ts';

function resolveSynthesizeModelConfig(modelId: string | null | undefined) {
  const id = modelId?.trim();
  if (id) return getModelById(id) ?? getDefaultChatModel();
  return getDefaultChatModel();
}

function buildEvidenceCatalog(evidences: ResearchEvidence[]): string {
  if (evidences.length === 0) {
    return '（本 Run 证据列表为空；请产出诚实不足/归纳说明，citeIds 与 citations 必须为空。）';
  }
  return evidences
    .map((e) => {
      const bits = [
        `id=${e.id}`,
        `kind=${e.kind}`,
        `title=${e.title}`,
        e.snippet ? `snippet=${e.snippet.slice(0, 200)}` : null,
        e.url ? `url=${e.url}` : null,
      ].filter(Boolean);
      return `- ${bits.join(' | ')}`;
    })
    .join('\n');
}

function buildNodeSummaries(row: RunRow): string {
  const graph = getGraph(row);
  const lines = (graph.nodes as ResearchNode[])
    .filter((n) => n.conclusionStatus !== 'pruned')
    .map((n) => {
      const role = n.role ?? 'research';
      const sum = n.summary?.trim() || '（无摘要）';
      const status = n.conclusionStatus ? ` status=${n.conclusionStatus}` : '';
      return `- [${role}] ${n.title}${status}: ${sum}`;
    });
  return lines.length ? lines.join('\n') : '（无节点摘要）';
}

/** Research nodes that remain missing / uncovered (c108 partial completion). */
function listUncoveredResearchTopics(row: RunRow): string[] {
  const graph = getGraph(row);
  return (graph.nodes as ResearchNode[])
    .filter((n) => {
      const role = n.role ?? (n.id.startsWith('node_root') ? 'question' : 'research');
      if (role !== 'research') return false;
      if (n.conclusionStatus === 'pruned') return false;
      if (n.conclusionStatus === 'missing') return true;
      if ((n.evidenceIds?.length ?? 0) === 0 && n.conclusionStatus !== 'clear') return true;
      return false;
    })
    .map((n) => n.title.trim() || n.id);
}

function buildPartialCompletionPromptHint(row: RunRow): string | null {
  const gaps = listUncoveredResearchTopics(row);
  if (gaps.length === 0) return null;
  return [
    '【预算用尽·部分完成】当前仍有未覆盖/未完成的研究节点。报告 MUST 明示「预算用尽·部分完成」，并列出未覆盖主题；MUST NOT 将残缺研究包装为已完整覆盖。已有证据仍正常综合。',
    `未覆盖主题：${gaps.join('；')}`,
  ].join('\n');
}

/** LLM structured ResearchReport (or e2e stub). Throws on model/schema failure. */
export async function generateLlmResearchReport(
  row: RunRow,
  evidences: ResearchEvidence[],
  abortSignal?: AbortSignal,
): Promise<ResearchReport> {
  if (isResearchE2eStub()) {
    return e2eStubResearchReport(row.topic, evidences.length);
  }

  const modelConfig = resolveSynthesizeModelConfig(row.modelId);
  if (!modelConfig) {
    throw new Error('No chat model configured for research synthesize');
  }

  const model = withRetry(await resolveModel(modelConfig));
  const maxOutputTokens = modelConfig.completionOptions?.maxTokens ?? 8192;
  const catalog = buildEvidenceCatalog(evidences);
  const nodeSummaries = buildNodeSummaries(row);
  const partialHint = buildPartialCompletionPromptHint(row);
  const prompt = [
    '你是深度研究结案写作者。请输出同形 ResearchReport JSON（title、sections、citations）。',
    `研究主题：${row.topic}`,
    '',
    '节点摘要：',
    nodeSummaries,
    '',
    '可用证据（cite key MUST 使用下列 id；禁止虚构 id）：',
    catalog,
    '',
    ...(partialHint ? [partialHint, ''] : []),
    '规则：',
    '- sections 为正文；blocks 为 paragraph 或 bullets；每处 citeIds 只能引用证据 id。',
    '- citations 为全局 map；key 必须是证据 id；无引用时用空对象 {}。',
    '- 引用是充分不必要条件：可以 0 cite 仍有结论；有证据可不引用。',
    '- 0 证据时写诚实不足说明，citeIds/citations 为空。',
    '- 禁止把证据清单当研究报告正文。',
    '- 最终只输出一个 JSON 对象，形状必须是 {"title":"...","sections":[...],"citations":{}}。',
    '- 不要 markdown 代码围栏；推理尽量短。',
  ].join('\n');

  try {
    const { object } = await generateObject({
      model,
      schema: ResearchReportSchema,
      abortSignal,
      maxOutputTokens,
      temperature: modelConfig.completionOptions?.temperature ?? 0.3,
      experimental_repairText: async ({ text }) => repairResearchReportText(text),
      prompt,
    });

    const parsed = ResearchReportSchema.safeParse(object);
    if (!parsed.success) {
      throw new Error(`Invalid ResearchReport from model: ${parsed.error.message}`);
    }
    return parsed.data;
  } catch (error) {
    // Think models often fail schema mode; free-text + local repair is the recovery path.
    const { text } = await generateText({
      model,
      abortSignal,
      maxOutputTokens,
      temperature: modelConfig.completionOptions?.temperature ?? 0.3,
      prompt,
    });
    const repaired = repairResearchReportText(text);
    if (!repaired) throw error;
    const parsed = ResearchReportSchema.safeParse(JSON.parse(repaired) as unknown);
    if (!parsed.success) throw error;
    return parsed.data;
  }
}

function failSynthesize(runId: number, reason: string): void {
  updateRun(runId, {
    status: 'failed',
    errorMessage: reason,
    confirmKind: null,
    confirmBranchNodeId: null,
    llmActivity: null,
    activeNodeId: null,
    report: null,
  });
  appendProgressEvent(runId, 'unit_aborted', {
    headline: '结案失败',
    payload: { failureReason: reason },
  });
  emitLog(runId, `结案失败：${reason}`);
  broadcast(runId, 'error', { errorCode: ErrorCode.INTERNAL_ERROR, message: reason });
  emitStatus(runId, 'failed', reason);
}

function completeWithReport(runId: number, row: RunRow, report: ResearchReport): void {
  const now = new Date();
  updateRun(runId, {
    status: 'completed',
    report: report as unknown as typeof row.report,
    reportUpdatedAt: now,
    errorMessage: null,
    confirmKind: null,
    confirmBranchNodeId: null,
    llmActivity: null,
    activeNodeId: null,
    checkpoint: writeCheckpoint({ ...row, status: 'completed' }, 'report'),
  });
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

export async function synthesizeAndComplete(runId: number): Promise<void> {
  if (isCancelled(runId)) {
    finalizeCancel(runId);
    return;
  }
  const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
  if (!row) return;

  emitLog(runId, '开始 LLM 结案成稿');
  appendProgressEvent(runId, 'unit_started', { headline: 'synthesize' });

  try {
    const evidences = listEvidences(runId);
    const raw = await generateLlmResearchReport(row, evidences);
    const bound = validateAndBindCitations(raw, evidences);
    if (!bound.ok) {
      failSynthesize(runId, `${SYNTHESIZE_FAILED_PREFIX}${bound.reason}`);
      return;
    }
    if (isCancelled(runId)) {
      finalizeCancel(runId);
      return;
    }
    completeWithReport(runId, row, bound.report);
  } catch (error) {
    if (isCancelled(runId)) {
      finalizeCancel(runId);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    failSynthesize(runId, `${SYNTHESIZE_MODEL_ERROR_PREFIX}${message}`);
  }
}

/**
 * Same-Run re-synthesize after synthesize-class failure.
 * MUST NOT re-run decompose / drain.
 */
export async function retrySynthesize(
  notebookId: number,
  runId: number,
  body: ResearchRetrySynthesizeBody = {},
): Promise<ResearchRun> {
  const row = requireRun(notebookId, runId);
  if (row.status !== 'failed' || !isSynthesizeFailureReason(row.errorMessage)) {
    throw new AppHttpError(
      ErrorCode.RESEARCH_INVALID_STATE,
      'retry-synthesize only allowed on synthesize-class failed runs',
    );
  }

  const patch: Partial<RunRow> = {
    status: 'running',
    errorMessage: null,
    confirmKind: null,
    confirmBranchNodeId: null,
    llmActivity: null,
    activeNodeId: null,
  };
  const override = body.modelId?.trim();
  if (override) {
    patch.modelId = override;
  }
  updateRun(runId, patch);
  emitStatus(runId, 'running', 'retry_synthesize');
  emitLog(runId, override ? `换模重试结案：${override}` : '重试结案');

  await synthesizeAndComplete(runId);
  return serializeRun(requireRun(notebookId, runId));
}

/**
 * @deprecated Heuristic evidence bullet list removed from success path (c102).
 * Stub-shaped helper retained for isolated fixtures only — MUST NOT complete a Run.
 */
export function synthesizeReport(row: RunRow): ResearchReport {
  const evidences = listEvidences(row.id);
  return e2eStubResearchReport(row.topic, evidences.length);
}

export function reportToMarkdown(report: ResearchReport): string {
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

export function resolveArtifactMarkdown(
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

export function assertReportEditable(status: string, hasReport: boolean): void {
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
