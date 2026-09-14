import type { LabCitation } from './types';

const CITE_RE = /\[\^([a-zA-Z0-9_-]+)\]/gu;
const NODE_REF_RE = /\[\^@([a-zA-Z0-9_-]+)\]/gu;

export function extractCitationIds(text: string): string[] {
  const ids: string[] = [];
  const re = new RegExp(CITE_RE.source, 'gu');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const id = m[1];
    if (!id || id.startsWith('@')) continue;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Block/section anchors into the thinking graph: `[^@n-libs]`. */
export function extractNodeIds(text: string): string[] {
  const ids: string[] = [];
  const re = new RegExp(NODE_REF_RE.source, 'gu');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1] && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

export function citationKindLabel(c: LabCitation | undefined): string {
  if (!c) return 'SRC';
  if (c.kind === 'docs') return 'DOC';
  if (c.kind === 'pdf') return 'PDF';
  if (c.kind === 'github') return 'GH';
  if (c.kind === 'paper') return 'PAPER';
  if (c.kind === 'community') return 'WEB';
  if (c.kind === 'upload') return 'FILE';
  return c.kind.toUpperCase();
}

/** Short label for pill, e.g. "2 DOC". */
export function citationPillLabel(c: LabCitation | undefined, fallbackId: string): string {
  const num =
    c?.notebookSourceId !== undefined && c.notebookSourceId !== null
      ? String(c.notebookSourceId)
      : fallbackId.replaceAll(/\D/gu, '') || '?';
  return `${num} ${citationKindLabel(c)}`;
}
