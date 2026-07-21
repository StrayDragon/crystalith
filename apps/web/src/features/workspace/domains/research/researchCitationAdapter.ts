import type { ResearchCitation, ResearchReport } from '@crystalith/shared';

import type { Citation } from '../../shared/types';

/** Map Run citation map → CitationsControl Citation[]. */
export function researchCitationMapToCitations(
  map: Record<string, ResearchCitation> | null | undefined,
): Citation[] {
  if (!map) return [];
  return Object.entries(map).map(([citeId, rc]) => researchCitationToUi(citeId, rc));
}

export function researchCitationToUi(citeId: string, rc: ResearchCitation): Citation {
  const rawChunk = rc.chunkId;
  let chunkId: number | null = null;
  if (typeof rawChunk === 'number' && Number.isFinite(rawChunk)) {
    chunkId = rawChunk;
  } else if (typeof rawChunk === 'string' && rawChunk.trim()) {
    const n = Number(rawChunk);
    chunkId = Number.isFinite(n) ? n : null;
  }

  return {
    id: citeId,
    chunkId,
    sourceId: rc.sourceId ?? null,
    sourceName: rc.sourceName || '未知来源',
    snippet: rc.snippet ?? '',
    chunkIndex: rc.chunkIndex ?? 0,
    pageNumber: rc.pageNumber ?? null,
    paragraphIndex: rc.paragraphIndex ?? null,
    score: rc.score ?? undefined,
  };
}

export function citationsFromReport(report: ResearchReport | null | undefined): Citation[] {
  return researchCitationMapToCitations(report?.citations);
}
