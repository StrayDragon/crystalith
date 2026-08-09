import type { ResearchCitation, ResearchEvidence, ResearchReport } from '@crystalith/shared';

import type { LabCitation } from './model/types';

/** Map ResearchEvidence → Lab drawer citation (r434). */
export function evidenceToLabCitation(ev: ResearchEvidence): LabCitation {
  const kind: LabCitation['kind'] =
    ev.kind === 'chunk' ? (ev.sourceId !== undefined ? 'upload' : 'docs') : 'web';
  return {
    id: ev.id,
    title: ev.title || ev.id,
    url: ev.url ?? '',
    // intentionally || — empty snippet falls back to title/placeholder
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing
    snippet: ev.snippet?.trim() || ev.title || '（无摘要）',
    kind,
    origin: ev.kind === 'chunk' && ev.sourceId !== undefined ? 'notebook' : 'research',
    notebookSourceId: ev.sourceId,
  };
}

/** Map report citation entry → LabCitation when evidence pool lacks the id. */
export function researchCitationToLabCitation(id: string, c: ResearchCitation): LabCitation {
  return {
    id,
    title: c.sourceName || id,
    url: c.url ?? '',
    snippet: c.snippet?.trim() || c.sourceName || '（无摘要）',
    kind: c.url ? 'web' : c.sourceId !== undefined ? 'upload' : 'docs',
    origin: c.sourceId !== undefined ? 'notebook' : 'research',
    notebookSourceId: c.sourceId ?? undefined,
  };
}

/** Placeholder when evidenceIds reference an id not yet in the map (r434 degrade). */
export function unknownEvidenceCitation(id: string): LabCitation {
  return {
    id,
    title: id,
    url: '',
    snippet: '加载中/未知证据',
    kind: 'web',
    origin: 'research',
  };
}

/**
 * Build Eden drawer citations map from Run evidences, optionally filling gaps
 * from report.citations (id-keyed). Does not use fixture scenario.citations.
 */
export function buildEdenCitationsMap(input: {
  evidences?: ResearchEvidence[] | null;
  report?: ResearchReport | null;
  evidenceIds?: string[];
}): Record<string, LabCitation> {
  const map: Record<string, LabCitation> = {};
  for (const ev of input.evidences ?? []) {
    map[ev.id] = evidenceToLabCitation(ev);
  }
  const reportCitations = input.report?.citations;
  if (reportCitations) {
    for (const [id, c] of Object.entries(reportCitations)) {
      if (!map[id]) map[id] = researchCitationToLabCitation(id, c);
    }
  }
  for (const id of input.evidenceIds ?? []) {
    if (!map[id]) map[id] = unknownEvidenceCitation(id);
  }
  return map;
}

/** Resolve drawer cite list: never empty-shell「暂无引用」 when ids exist. */
export function resolveNodeCitations(
  citationIds: string[],
  citations: Record<string, LabCitation>,
): LabCitation[] {
  return citationIds.map((id) => citations[id] ?? unknownEvidenceCitation(id));
}
