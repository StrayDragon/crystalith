/** Shared helpers for citation source vs chunk counts. */

type CitationSourceFields = {
  sourceId?: number | null;
  source_id?: number | null;
  sourceTitle?: string | null;
  source_name?: string | null;
};

export function countUniqueCitationSources(citations: CitationSourceFields[]): number {
  const keys = new Set<string>();
  for (const citation of citations) {
    const sourceId = citation.sourceId ?? citation.source_id;
    if (sourceId != null) {
      keys.add(`id:${sourceId}`);
      continue;
    }
    const sourceName = citation.sourceTitle ?? citation.source_name;
    if (sourceName) {
      keys.add(`name:${sourceName}`);
    }
  }
  return keys.size;
}

export function formatCitationScopeLabel(sourceCount: number, chunkCount: number): string {
  return `来自 ${sourceCount} 个来源 · ${chunkCount} 个片段`;
}
