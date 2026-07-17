/** Shared helpers for citation source vs chunk counts. */

export function countUniqueCitationSources(
  citations: Array<{ source_id?: number | null; source_name?: string | null }>,
): number {
  const keys = new Set<string>();
  for (const citation of citations) {
    if (citation.source_id != null) {
      keys.add(`id:${citation.source_id}`);
      continue;
    }
    if (citation.source_name) {
      keys.add(`name:${citation.source_name}`);
    }
  }
  return keys.size;
}

export function formatCitationScopeLabel(sourceCount: number, chunkCount: number): string {
  return `来自 ${sourceCount} 个来源 · ${chunkCount} 个片段`;
}
