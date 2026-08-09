import type { LabCitation } from './types';

const CITE_RE = /\[\^([a-zA-Z0-9_-]+)\]/gu;
const NODE_REF_RE = /\[\^@([a-zA-Z0-9_-]+)\]/gu;

export interface ReportInlinePart {
  type: 'text' | 'code' | 'cite' | 'node';
  text: string;
  citationId?: string;
  nodeId?: string;
}

export interface ReportSection {
  id: string;
  heading: string | null;
  /** Raw body markdown (without heading line). */
  body: string;
  citationIds: string[];
  /** Graph node anchors in this section (`[^@nodeId]`). */
  nodeIds: string[];
  /** First citation for gutter pill when in compare mode. */
  primaryCitationId: string | null;
}

/** Notion-like structured block inside a continuous markdown article. */
export type ReportBlockKind = 'heading' | 'paragraph' | 'list_item';

export interface ReportBlock {
  id: string;
  kind: ReportBlockKind;
  /** Heading level 1–3 when kind=heading. */
  level?: number;
  text: string;
  citationIds: string[];
  /** Owning thinking-graph node ids (`[^@id]`). */
  nodeIds: string[];
  /** Owning ##/### section id for scrollspy / gutter grouping. */
  sectionId: string;
}

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

/** Split report into ## / ### sections for aligned evidence gutter. */
export function parseReportSections(markdown: string): ReportSection[] {
  const lines = markdown.split('\n');
  const sections: ReportSection[] = [];
  let heading: string | null = null;
  let buf: string[] = [];
  let idx = 0;

  const flush = () => {
    const body = buf.join('\n').trim();
    if (!heading && !body) return;
    const blob = `${heading ?? ''}\n${body}`;
    const citationIds = extractCitationIds(blob);
    sections.push({
      id: `sec-${idx++}`,
      heading,
      body,
      citationIds,
      nodeIds: extractNodeIds(blob),
      primaryCitationId: citationIds[0] ?? null,
    });
    buf = [];
  };

  for (const line of lines) {
    if (/^#{1,3}\s+/u.test(line)) {
      flush();
      heading = line.replace(/^#{1,3}\s+/u, '').trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * Flatten markdown into selectable blocks (heading / paragraph / list item)
 * so the article reads normally but supports Notion-like block highlight.
 */
export function parseReportBlocks(markdown: string): ReportBlock[] {
  const lines = markdown.split('\n');
  const blocks: ReportBlock[] = [];
  let sectionId = 'sec-0';
  let sectionIdx = 0;
  let blockIdx = 0;
  let paraBuf: string[] = [];

  const flushPara = () => {
    const text = paraBuf.join('\n').trim();
    paraBuf = [];
    if (!text) return;
    blocks.push({
      id: `blk-${blockIdx++}`,
      kind: 'paragraph',
      text,
      citationIds: extractCitationIds(text),
      nodeIds: extractNodeIds(text),
      sectionId,
    });
  };

  for (const raw of lines) {
    const headingMatch = raw.match(/^(#{1,3})\s+(.*)$/u);
    if (headingMatch) {
      flushPara();
      sectionId = `sec-${sectionIdx++}`;
      const level = headingMatch[1]!.length;
      const text = headingMatch[2]!.trim();
      blocks.push({
        id: `blk-${blockIdx++}`,
        kind: 'heading',
        level,
        text,
        citationIds: extractCitationIds(text),
        nodeIds: extractNodeIds(text),
        sectionId,
      });
      continue;
    }

    if (/^\s*$/u.test(raw)) {
      flushPara();
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/u.test(raw)) {
      flushPara();
      const text = raw.trim();
      blocks.push({
        id: `blk-${blockIdx++}`,
        kind: 'list_item',
        text,
        citationIds: extractCitationIds(text),
        nodeIds: extractNodeIds(text),
        sectionId,
      });
      continue;
    }

    paraBuf.push(raw);
  }
  flushPara();
  return blocks;
}

/** Tokenize a line into text / inline code / citation / node pills. */
export function parseInlineParts(line: string): ReportInlinePart[] {
  const parts: ReportInlinePart[] = [];
  const combined = /`([^`]+)`|\[\^@([a-zA-Z0-9_-]+)\]|\[\^([a-zA-Z0-9_-]+)\]/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = combined.exec(line))) {
    if (m.index > last) {
      parts.push({ type: 'text', text: line.slice(last, m.index) });
    }
    if (m[1] !== undefined) {
      parts.push({ type: 'code', text: m[1] });
    } else if (m[2] !== undefined) {
      parts.push({ type: 'node', text: m[2], nodeId: m[2] });
    } else if (m[3] !== undefined) {
      parts.push({ type: 'cite', text: m[3], citationId: m[3] });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ type: 'text', text: line.slice(last) });
  if (parts.length === 0) parts.push({ type: 'text', text: line });
  return parts;
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
