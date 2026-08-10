/**
 * Research report revision CRUD + fork-from-revision CoW.
 */
import type {
  ResearchEdge,
  ResearchNode,
  ResearchReport,
  ResearchRevision,
  ResearchRevisionCreateBody,
  ResearchRun,
} from '@crystalith/shared';
import { ResearchRunStatusSchema } from '@crystalith/shared';
import { and, desc, eq } from 'drizzle-orm';
import { NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import {
  researchReportEdits,
  researchRevisions,
  researchRuns,
  type ResearchReportJson,
} from '../../db/schema.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { collectClaimedCiteIds } from './report-citations.ts';
import {
  appendProgressEvent,
  broadcast,
  emitGraphPatch,
  getGraph,
  insertEvidence,
  isTerminalStatus,
  listEvidences,
  newId,
  requireRun,
  serializeRun,
  updateRun,
} from './research-core.ts';

export function serializeRevision(row: typeof researchRevisions.$inferSelect): ResearchRevision {
  return {
    id: row.id,
    runId: row.runId,
    notebookId: row.notebookId,
    label: row.label,
    kind: row.kind,
    parentRevisionId: row.parentRevisionId ?? null,
    graph: row.graph,
    report: row.report ?? null,
    searchesUsed: row.searchesUsed,
    statusAtSave: ResearchRunStatusSchema.parse(row.statusAtSave),
    createdAt: row.createdAt.toISOString(),
  };
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
  let report: ResearchReportJson | null = row.report ?? null;
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
      // intentionally || — empty label gets timestamp default
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing
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
    nodes: rev.graph.nodes ?? [],
    edges: rev.graph.edges ?? [],
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

  const snapshotGraph = structuredClone(rev.graph);
  const snapshotReport = rev.report ? structuredClone(rev.report) : null;

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
