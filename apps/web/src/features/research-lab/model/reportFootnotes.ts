import { extractCitationIds, extractNodeIds } from './reportDocument';
import type { LabCitation } from './types';

/** Append GFM footnote definitions so Plate/remark can round-trip [^id] / [^@node] cleanly. */
export function withFootnoteDefinitions(
  markdown: string,
  citations: Record<string, LabCitation>,
): string {
  const citeIds = extractCitationIds(markdown);
  const nodeIds = extractNodeIds(markdown);
  if (citeIds.length === 0 && nodeIds.length === 0) return markdown;
  const body = markdown.replaceAll(/\n*(\[\^@?[a-zA-Z0-9_-]+\]:[^\n]*\n*)+$/g, '').trimEnd();
  const defs = [
    ...citeIds.map((id) => {
      const c = citations[id];
      const title = (c?.title ?? id).replaceAll(/\n/g, ' ');
      return `[^${id}]: ${title}`;
    }),
    ...nodeIds.map((id) => `[^@${id}]: lab-node:${id}`),
  ];
  return `${body}\n\n${defs.join('\n')}\n`;
}

/** Drop trailing footnote definition block for CoW storage (inline [^id] stays). */
export function stripFootnoteDefinitions(markdown: string): string {
  return markdown.replaceAll(/\n*(\[\^@?[a-zA-Z0-9_-]+\]:[^\n]*\n*)+$/g, '').trimEnd() + '\n';
}
