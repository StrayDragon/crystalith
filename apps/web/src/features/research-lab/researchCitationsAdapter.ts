import type { ResearchCitation } from '@crystalith/shared';

import type { Citation } from '../workspace/shared/types';

/** Map ResearchReport.citations → CitationsControl Citation[] (r408 / r432). */
export function adaptResearchCitationsToUi(
  citations: Record<string, ResearchCitation> | null | undefined,
): Citation[] {
  if (!citations) return [];
  return Object.entries(citations).map(([id, c]) => {
    const chunkIdRaw = c.chunkId;
    const chunkId =
      typeof chunkIdRaw === 'number'
        ? chunkIdRaw
        : typeof chunkIdRaw === 'string' && /^\d+$/u.test(chunkIdRaw)
          ? Number(chunkIdRaw)
          : null;
    return {
      id,
      chunkId,
      sourceId: c.sourceId ?? null,
      sourceName: c.sourceName,
      snippet: c.snippet,
      chunkIndex: c.chunkIndex ?? 0,
      pageNumber: c.pageNumber ?? null,
      paragraphIndex: c.paragraphIndex ?? null,
      score: c.score ?? undefined,
    };
  });
}
