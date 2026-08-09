import type { ResearchConclusionStatus } from '@crystalith/shared';

import { isRecord, parseJsonValue } from '../../../shared/json';
import type { LabGraphMutations, LabPhase } from '../../research-lab/model/types';
import { EMPTY_MUTATIONS } from './deriveLabState';

/**
 * Paired revision: thinking-graph snapshot + report result.
 * Fixture-only sessionStorage demo (`/demo/research-lab`) — MUST NOT be Eden SSOT (c89 / r444).
 */
export interface LabRevisionGraphSlice {
  phase: LabPhase;
  mutations: LabGraphMutations;
  topicDraft: string;
  forkSeq: number;
  forceStatus: ResearchConclusionStatus | null;
}

export interface LabRevision {
  id: string;
  notebookId: number;
  scenarioId: string;
  label: string;
  kind: 'default_export' | 'user_save';
  createdAt: string;
  parentId: string | null;
  reportMarkdown: string;
  graph: LabRevisionGraphSlice;
}

export interface LabRevisionStore {
  notebookId: number;
  scenarioId: string;
  activeId: string | null;
  revisions: LabRevision[];
}

const STORE_PREFIX = 'crystalith.research-lab.revisions';

export function revisionsStorageKey(notebookId: number, scenarioId: string): string {
  return `${STORE_PREFIX}.${notebookId}.${scenarioId}`;
}

export function emptyGraphSlice(topicDraft = ''): LabRevisionGraphSlice {
  return {
    phase: 'completed',
    mutations: EMPTY_MUTATIONS,
    topicDraft,
    forkSeq: 0,
    forceStatus: null,
  };
}

export function readRevisionStore(notebookId: number, scenarioId: string): LabRevisionStore {
  try {
    const raw = sessionStorage.getItem(revisionsStorageKey(notebookId, scenarioId));
    if (!raw) {
      return { notebookId, scenarioId, activeId: null, revisions: [] };
    }
    const parsed = parseJsonValue(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.revisions)) {
      return { notebookId, scenarioId, activeId: null, revisions: [] };
    }
    return {
      notebookId,
      scenarioId,
      activeId:
        typeof parsed.activeId === 'string' || parsed.activeId === null
          ? parsed.activeId
          : (parsed.revisions[0]?.id ?? null),
      revisions: parsed.revisions as LabRevision[],
    };
  } catch {
    return { notebookId, scenarioId, activeId: null, revisions: [] };
  }
}

export function persistRevisionStore(store: LabRevisionStore): void {
  try {
    sessionStorage.setItem(
      revisionsStorageKey(store.notebookId, store.scenarioId),
      JSON.stringify(store),
    );
  } catch {
    /* ignore */
  }
}

function newId(): string {
  return `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Ensure v0 default export exists; returns active revision. */
export function ensureDefaultRevision(input: {
  notebookId: number;
  scenarioId: string;
  reportMarkdown: string;
  graph: LabRevisionGraphSlice;
  label?: string;
}): LabRevision {
  const store = readRevisionStore(input.notebookId, input.scenarioId);
  const existing = store.revisions.find((r) => r.kind === 'default_export');
  if (existing) {
    if (!store.activeId) {
      persistRevisionStore({ ...store, activeId: existing.id });
    }
    return existing;
  }
  const rev: LabRevision = {
    id: newId(),
    notebookId: input.notebookId,
    scenarioId: input.scenarioId,
    label: input.label ?? '默认建议报告',
    kind: 'default_export',
    createdAt: new Date().toISOString(),
    parentId: null,
    reportMarkdown: input.reportMarkdown,
    graph: input.graph,
  };
  const next: LabRevisionStore = {
    notebookId: input.notebookId,
    scenarioId: input.scenarioId,
    activeId: rev.id,
    revisions: [rev, ...store.revisions],
  };
  persistRevisionStore(next);
  return rev;
}

/** Save a new user revision (graph + report). */
export function saveNewRevision(input: {
  notebookId: number;
  scenarioId: string;
  reportMarkdown: string;
  graph: LabRevisionGraphSlice;
  label?: string;
  parentId?: string | null;
}): LabRevision {
  const store = readRevisionStore(input.notebookId, input.scenarioId);
  const n = store.revisions.filter((r) => r.kind === 'user_save').length + 1;
  const rev: LabRevision = {
    id: newId(),
    notebookId: input.notebookId,
    scenarioId: input.scenarioId,
    label: input.label ?? `第 ${n} 轮`,
    kind: 'user_save',
    createdAt: new Date().toISOString(),
    parentId: input.parentId ?? store.activeId,
    reportMarkdown: input.reportMarkdown,
    graph: input.graph,
  };
  const next: LabRevisionStore = {
    ...store,
    activeId: rev.id,
    revisions: [rev, ...store.revisions],
  };
  persistRevisionStore(next);
  return rev;
}

export function setActiveRevision(
  notebookId: number,
  scenarioId: string,
  revisionId: string,
): LabRevision | null {
  const store = readRevisionStore(notebookId, scenarioId);
  const rev = store.revisions.find((r) => r.id === revisionId);
  if (!rev) return null;
  persistRevisionStore({ ...store, activeId: revisionId });
  return rev;
}

export function getActiveRevision(notebookId: number, scenarioId: string): LabRevision | null {
  const store = readRevisionStore(notebookId, scenarioId);
  if (!store.activeId) return store.revisions[0] ?? null;
  return store.revisions.find((r) => r.id === store.activeId) ?? store.revisions[0] ?? null;
}

export function listRevisions(notebookId: number, scenarioId: string): LabRevision[] {
  return readRevisionStore(notebookId, scenarioId).revisions;
}

/** Replace default_export markdown/graph (re-export from current graph). */
export function updateDefaultRevision(input: {
  notebookId: number;
  scenarioId: string;
  reportMarkdown: string;
  graph: LabRevisionGraphSlice;
}): LabRevision {
  const store = readRevisionStore(input.notebookId, input.scenarioId);
  const idx = store.revisions.findIndex((r) => r.kind === 'default_export');
  if (idx < 0) {
    return ensureDefaultRevision({
      notebookId: input.notebookId,
      scenarioId: input.scenarioId,
      reportMarkdown: input.reportMarkdown,
      graph: input.graph,
    });
  }
  const prev = store.revisions[idx];
  const updated: LabRevision = {
    ...prev,
    reportMarkdown: input.reportMarkdown,
    graph: input.graph,
    createdAt: new Date().toISOString(),
  };
  const revisions = [...store.revisions];
  revisions[idx] = updated;
  persistRevisionStore({
    ...store,
    activeId: updated.id,
    revisions,
  });
  return updated;
}

export function graphSliceFromSession(session: {
  phase: LabPhase;
  mutations: LabGraphMutations;
  topicDraft: string;
  forkSeq: number;
  forceStatus: ResearchConclusionStatus | null;
}): LabRevisionGraphSlice {
  return {
    phase: session.phase,
    mutations: session.mutations ?? EMPTY_MUTATIONS,
    topicDraft: session.topicDraft ?? '',
    forkSeq: session.forkSeq ?? 0,
    forceStatus: session.forceStatus ?? null,
  };
}
