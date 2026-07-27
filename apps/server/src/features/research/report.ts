/**
 * Deep Research report synthesis, revisions, and report CoW APIs.
 */
import type {
  ResearchConvertBody,
  ResearchEdge,
  ResearchEvidence,
  ResearchNode,
  ResearchProgressEvent,
  ResearchProgressKind,
  ResearchReport,
  ResearchReportView,
  ResearchRetrySynthesizeBody,
  ResearchRevision,
  ResearchRevisionCreateBody,
  ResearchRun,
  ResearchRunStatus,
} from '@crystalith/shared';
import { ResearchReportSchema } from '@crystalith/shared';
import { generateObject, generateText } from 'ai';
import { and, asc, desc, eq, gt } from 'drizzle-orm';
import { NotFoundError } from 'elysia';

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
  appendProgressEvent,
  broadcast,
  emitGraphPatch,
  emitLog,
  emitStatus,
  finalizeCancel,
  getGraph,
  insertEvidence,
  isCancelled,
  isTerminalStatus,
  listEvidences,
  newId,
  requireRun,
  serializeRun,
  updateRun,
  writeCheckpoint,
  type RunRow,
} from './research-core.ts';

export const SYNTHESIZE_FAILED_PREFIX = 'synthesize_failed:';
export const SYNTHESIZE_MODEL_ERROR_PREFIX = 'synthesize_model_error:';

export function isSynthesizeFailureReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return (
    reason.startsWith(SYNTHESIZE_FAILED_PREFIX) || reason.startsWith(SYNTHESIZE_MODEL_ERROR_PREFIX)
  );
}

function resolveSynthesizeModelConfig(modelId: string | null | undefined) {
  const id = modelId?.trim();
  if (id) return getModelById(id) ?? getDefaultChatModel();
  return getDefaultChatModel();
}

/** Collect all cite keys the model claimed (map keys + inline citeIds). */
export function collectClaimedCiteIds(report: ResearchReport): Set<string> {
  const ids = new Set<string>();
  for (const key of Object.keys(report.citations ?? {})) ids.add(key);
  for (const section of report.sections) {
    for (const block of section.blocks) {
      if (block.type === 'paragraph') {
        for (const id of block.citeIds) ids.add(id);
      } else {
        for (const item of block.items) {
          for (const id of item.citeIds) ids.add(id);
        }
      }
    }
  }
  return ids;
}

function citationFromEvidence(ev: ResearchEvidence): ResearchReport['citations'][string] {
  return {
    sourceName: ev.title,
    snippet: ev.snippet ?? ev.title,
    url: ev.url,
    sourceId: ev.sourceId,
    chunkId: ev.chunkId,
  };
}

/**
 * Bind cites to Run evidence map: strip illegal keys; fail only when model claimed
 * cites and none remain legal (all-illegal / hallucinated).
 */
export function validateAndBindCitations(
  report: ResearchReport,
  evidences: ResearchEvidence[],
): { ok: true; report: ResearchReport } | { ok: false; reason: string } {
  const byId = new Map(evidences.map((e) => [e.id, e]));
  const claimed = collectClaimedCiteIds(report);
  const legalKeys = new Set([...claimed].filter((id) => byId.has(id)));

  if (claimed.size > 0 && legalKeys.size === 0) {
    return { ok: false, reason: 'claimed cites all illegal' };
  }

  const filterIds = (ids: string[]) => ids.filter((id) => legalKeys.has(id));
  const sections = report.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => {
      if (block.type === 'paragraph') {
        return { ...block, citeIds: filterIds(block.citeIds) };
      }
      return {
        ...block,
        items: block.items.map((item) => ({ ...item, citeIds: filterIds(item.citeIds) })),
      };
    }),
  }));

  const citations: ResearchReport['citations'] = {};
  for (const id of legalKeys) {
    const ev = byId.get(id)!;
    const fromModel = report.citations[id];
    citations[id] = fromModel
      ? {
          ...citationFromEvidence(ev),
          ...fromModel,
          sourceName: fromModel.sourceName || ev.title,
          snippet: fromModel.snippet || ev.snippet || ev.title,
        }
      : citationFromEvidence(ev);
  }

  return {
    ok: true,
    report: {
      title: report.title,
      sections,
      citations,
    },
  };
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

/**
 * Local / think models often emit fenced JSON, preamble, or omit `citations`.
 * Used by generateObject repair + unit tests (mirrors repairDecomposePlanText).
 */
export function repairResearchReportText(text: string): string | null {
  let trimmed = text.trim();
  if (!trimmed) return null;

  trimmed = trimmed.replaceAll(/<think>[\s\S]*?<\/think>/giu, '').trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);
  if (fenced) trimmed = fenced[1]!.trim();

  const start = trimmed.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;

  try {
    const raw: unknown = JSON.parse(trimmed.slice(start, end + 1));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.title !== 'string') return null;
    if (!Array.isArray(obj.sections)) return null;
    if (
      obj.citations === null ||
      obj.citations === undefined ||
      typeof obj.citations !== 'object' ||
      Array.isArray(obj.citations)
    ) {
      obj.citations = {};
    }

    const citationsIn = obj.citations as Record<string, unknown>;
    const citationsOut: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(citationsIn)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        citationsOut[key] = { sourceName: key, snippet: '' };
        continue;
      }
      const c = value as Record<string, unknown>;
      const repaired: Record<string, unknown> = {
        sourceName: typeof c.sourceName === 'string' && c.sourceName ? c.sourceName : key,
        snippet: typeof c.snippet === 'string' ? c.snippet : '',
      };
      if (typeof c.url === 'string') repaired.url = c.url;
      if (typeof c.sourceId === 'number' && Number.isInteger(c.sourceId) && c.sourceId > 0) {
        repaired.sourceId = c.sourceId;
      }
      if (typeof c.chunkId === 'number' || typeof c.chunkId === 'string') {
        repaired.chunkId = c.chunkId;
      }
      if (typeof c.chunkIndex === 'number' && Number.isInteger(c.chunkIndex)) {
        repaired.chunkIndex = c.chunkIndex;
      }
      citationsOut[key] = repaired;
    }
    obj.citations = citationsOut;

    obj.sections = (obj.sections as unknown[]).map((section, idx) => {
      if (!section || typeof section !== 'object' || Array.isArray(section)) {
        return {
          id: `s${idx + 1}`,
          heading: '节',
          blocks: [{ type: 'paragraph', text: String(section ?? ''), citeIds: [] }],
        };
      }
      const s = section as Record<string, unknown>;
      const id = typeof s.id === 'string' && s.id.trim() ? s.id : `s${idx + 1}`;
      const heading = typeof s.heading === 'string' ? s.heading : '节';
      const blocksRaw = Array.isArray(s.blocks) ? s.blocks : [];
      const blocks = blocksRaw.map((block) => {
        if (!block || typeof block !== 'object' || Array.isArray(block)) {
          return { type: 'paragraph', text: String(block ?? ''), citeIds: [] };
        }
        const b = block as Record<string, unknown>;
        if (b.type === 'bullets') {
          const items = Array.isArray(b.items) ? b.items : [];
          return {
            type: 'bullets',
            items: items.map((item) => {
              if (!item || typeof item !== 'object' || Array.isArray(item)) {
                return { text: String(item ?? ''), citeIds: [] };
              }
              const it = item as Record<string, unknown>;
              return {
                text: typeof it.text === 'string' ? it.text : String(it.text ?? ''),
                citeIds: Array.isArray(it.citeIds)
                  ? it.citeIds.filter((x): x is string => typeof x === 'string')
                  : [],
              };
            }),
          };
        }
        return {
          type: 'paragraph',
          text: typeof b.text === 'string' ? b.text : String(b.text ?? ''),
          citeIds: Array.isArray(b.citeIds)
            ? b.citeIds.filter((x): x is string => typeof x === 'string')
            : [],
        };
      });
      return { id, heading, blocks };
    });

    return JSON.stringify(obj);
  } catch {
    return null;
  }
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

export function serializeRevision(row: typeof researchRevisions.$inferSelect): ResearchRevision {
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

function collectReferencedEvidenceIds(
  graph: { nodes?: ResearchNode[] },
  report: ResearchReport | null,
): Set<string> {
  const ids = new Set<string>();
  for (const node of graph.nodes ?? []) {
    for (const eid of node.evidenceIds ?? []) ids.add(eid);
  }
  if (report) {
    for (const id of collectClaimedCiteIds(report)) ids.add(id);
  }
  return ids;
}

function remapEvidenceId(id: string, idMap: Map<string, string>): string {
  return idMap.get(id) ?? id;
}

function remapGraphEvidenceIds(
  graph: { nodes: ResearchNode[]; edges: ResearchEdge[] },
  idMap: Map<string, string>,
): { nodes: ResearchNode[]; edges: ResearchEdge[] } {
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      evidenceIds: (node.evidenceIds ?? []).map((id) => remapEvidenceId(id, idMap)),
    })),
    edges: graph.edges.map((e) => ({ ...e })),
  };
}

function remapReportEvidenceIds(
  report: ResearchReport,
  idMap: Map<string, string>,
): ResearchReport {
  const citations: ResearchReport['citations'] = {};
  for (const [key, value] of Object.entries(report.citations ?? {})) {
    citations[remapEvidenceId(key, idMap)] = value;
  }
  const sections = report.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => {
      if (block.type === 'paragraph') {
        return {
          ...block,
          citeIds: block.citeIds.map((id) => remapEvidenceId(id, idMap)),
        };
      }
      return {
        ...block,
        items: block.items.map((item) => ({
          ...item,
          citeIds: item.citeIds.map((id) => remapEvidenceId(id, idMap)),
        })),
      };
    }),
  }));
  return { title: report.title, sections, citations };
}

/**
 * POST …/revisions/:revId/fork-run — create a new ResearchRun from a revision snapshot.
 * Does NOT schedule; caller may call scheduleRun when body.schedule is true.
 * Source Run is never mutated.
 */
export function forkRunFromRevision(notebookId: number, runId: number, revId: string): ResearchRun {
  const source = requireRun(notebookId, runId);
  const rev = db()
    .select()
    .from(researchRevisions)
    .where(and(eq(researchRevisions.runId, runId), eq(researchRevisions.id, revId)))
    .get();
  if (!rev) throw new NotFoundError(`Revision ${revId} not found`);

  const snapshotGraph = structuredClone(rev.graph) as {
    nodes: ResearchNode[];
    edges: ResearchEdge[];
  };
  const snapshotReport = rev.report ? (structuredClone(rev.report) as ResearchReport) : null;

  const referenced = collectReferencedEvidenceIds(snapshotGraph, snapshotReport);
  const sourceEvidences = listEvidences(runId);
  const idMap = new Map<string, string>();
  for (const ev of sourceEvidences) {
    if (!referenced.has(ev.id)) continue;
    idMap.set(ev.id, newId('ev'));
  }

  const remappedGraph = remapGraphEvidenceIds(snapshotGraph, idMap);
  const remappedReport = snapshotReport ? remapReportEvidenceIds(snapshotReport, idMap) : null;

  const inserted = db()
    .insert(researchRuns)
    .values({
      notebookId,
      topic: source.topic,
      status: 'queued',
      useNotebookSources: source.useNotebookSources,
      allowWeb: source.allowWeb,
      sourceIds: source.sourceIds,
      depth: source.depth,
      maxSearches: source.maxSearches,
      maxNodes: source.maxNodes,
      searchesUsed: 0,
      maxPageFetches: source.maxPageFetches,
      pagesUsed: 0,
      modelId: source.modelId,
      graph: remappedGraph,
      checkpoint: null,
      report: remappedReport,
      confirmKind: null,
      confirmBranchNodeId: null,
      cancelRequested: false,
      errorMessage: null,
      activeRevisionId: null,
      activeNodeId: null,
      llmActivity: null,
      reportUpdatedAt: remappedReport ? new Date() : null,
    })
    .returning()
    .get();

  for (const ev of sourceEvidences) {
    const newIdValue = idMap.get(ev.id);
    if (!newIdValue) continue;
    insertEvidence(inserted.id, notebookId, {
      id: newIdValue,
      kind: ev.kind,
      title: ev.title,
      snippet: ev.snippet,
      content: ev.content,
      url: ev.url,
      sourceId: ev.sourceId,
      chunkId: ev.chunkId,
      collectedAtNodeId: ev.collectedAtNodeId,
    });
  }

  appendProgressEvent(inserted.id, 'run_queued', {
    headline: `从修订「${rev.label}」派生`,
    payload: {
      forkedFromRunId: runId,
      forkedFromRevisionId: revId,
    },
  });

  return serializeRun(inserted);
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
