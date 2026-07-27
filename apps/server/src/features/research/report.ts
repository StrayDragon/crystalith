/**
 * Deep Research report synthesis, revisions, and report CoW APIs.
 */
import type {
  ResearchConvertBody,
  ResearchEdge,
  ResearchNode,
  ResearchProgressEvent,
  ResearchProgressKind,
  ResearchReport,
  ResearchReportView,
  ResearchRevision,
  ResearchRevisionCreateBody,
  ResearchRun,
  ResearchRunStatus,
} from '@crystalith/shared';
import { and, asc, desc, eq, gt } from 'drizzle-orm';
import { NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import {
  researchProgressEvents,
  researchReportEdits,
  researchRevisions,
  researchRuns,
  type ResearchReportJson,
} from '../../db/schema.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import {
  appendProgressEvent,
  broadcast,
  emitGraphPatch,
  emitLog,
  emitStatus,
  finalizeCancel,
  getGraph,
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

export async function synthesizeAndComplete(runId: number): Promise<void> {
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
