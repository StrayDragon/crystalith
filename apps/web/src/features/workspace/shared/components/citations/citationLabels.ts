/** Citation scope labels — UI domain uses camelCase `Citation` only. */

import type { Citation } from '../../types';

/**
 * Count unique sources among already-normalized UI citations.
 * Wire/API camelCase (`sourceId`) MUST be mapped via `normalizeCitation` first.
 */
export function countUniqueCitationSources(citations: Citation[]): number {
  const keys = new Set<string>();
  for (const citation of citations) {
    if (citation.sourceId != null) {
      keys.add(`id:${citation.sourceId}`);
      continue;
    }
    const title = citation.sourceName?.trim();
    if (title) {
      keys.add(`name:${title}`);
    }
  }
  return keys.size;
}

export function formatCitationScopeLabel(sourceCount: number, chunkCount: number): string {
  return `来自 ${sourceCount} 个来源 · ${chunkCount} 个片段`;
}
