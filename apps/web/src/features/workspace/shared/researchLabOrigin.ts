/**
 * Read Deep Research origin stamped on converted PARAGRAPH notes (兜底导航).
 * Accepts full content or list-row projection field.
 */
export type ResearchLabOriginHint = {
  notebookId: number;
  runId: number;
  artifactKind?: 'report' | 'node' | 'evidence';
};

function parseOrigin(raw: unknown): ResearchLabOriginHint | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const notebookId = Number((raw as { notebookId?: unknown }).notebookId);
  const runId = Number((raw as { runId?: unknown }).runId);
  if (!(notebookId > 0) || !(runId > 0)) return null;
  const kind = (raw as { artifactKind?: unknown }).artifactKind;
  const artifactKind =
    kind === 'report' || kind === 'node' || kind === 'evidence' ? kind : undefined;
  return { notebookId, runId, artifactKind };
}

/** Prefer list-row `researchLab`, then content.researchLab / item.researchLab. */
export function readResearchLabOrigin(
  contentOrItem: unknown,
  listResearchLab?: unknown,
): ResearchLabOriginHint | null {
  const fromList = parseOrigin(listResearchLab);
  if (fromList) return fromList;
  if (!contentOrItem || typeof contentOrItem !== 'object' || Array.isArray(contentOrItem)) {
    return null;
  }
  const asItem = contentOrItem as { researchLab?: unknown; content?: unknown };
  const fromItemField = parseOrigin(asItem.researchLab);
  if (fromItemField) return fromItemField;
  if (asItem.content && typeof asItem.content === 'object' && !Array.isArray(asItem.content)) {
    return parseOrigin((asItem.content as { researchLab?: unknown }).researchLab);
  }
  // Content-only object: `{ title, text, researchLab }`
  return parseOrigin((contentOrItem as { researchLab?: unknown }).researchLab);
}
