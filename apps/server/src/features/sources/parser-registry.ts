// Parser registry — maps MIME types to parser implementations loaded from
// pluginRegistry (kind: 'parser'). Callers MUST await
// pluginRegistry.ensureLoaded() before getParser/selectParser/listLoadedParsers.
//
// Wire parserType is the short id ('pdf' | 'html' | 'csv' | 'text' | 'docx');
// plugin id is `parser-<wire>` (r497).
import { pluginRegistry } from '../../plugins/registry.ts';
import { getPluginsSettings } from '../../shared/config.ts';

export interface ParsePage {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface ParseResult {
  text: string;
  pages?: ParsePage[];
  metadata?: Record<string, unknown>;
}

export interface Parser {
  /** Unique identifier, e.g. "pdf", "html", "text". */
  id: string;
  /** Human-readable name. */
  name: string;
  /** MIME types this parser handles (exact match or prefix). */
  mimeTypes: string[];
  /** File extensions this parser handles (lowercased, with dot). */
  extensions: string[];
  /** Parse raw bytes → structured text result. */
  parse(buf: Uint8Array, filename?: string): Promise<ParseResult>;
}

export interface LoadedParser {
  pluginId: string;
  parser: Parser;
}

const PARSER_ID_PREFIX = 'parser-';

/** Loaded parser plugins in instantiation order (plugins.load_order aware). */
export function listLoadedParsers(): LoadedParser[] {
  return pluginRegistry.loadedByKind('parser').map(({ plugin }) => ({
    pluginId: plugin.id,
    parser: pluginRegistry.implOf<Parser>(plugin.id)!,
  }));
}

function pickParser(matches: LoadedParser[]): Parser | undefined {
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0]?.parser;
  const order = getPluginsSettings().load_order;
  const listed = matches
    .map((m) => ({ m, i: order.indexOf(m.pluginId) }))
    .filter(({ i }) => i >= 0);
  if (listed.length > 0) {
    return listed.reduce((best, cur) => (cur.i > best.i ? cur : best)).m.parser;
  }
  return matches.toSorted((a, b) => a.pluginId.localeCompare(b.pluginId))[0]?.parser;
}

/** Get a loaded parser by wire id (`text`) or plugin id (`parser-text`). */
export function getParser(id: string): Parser | undefined {
  return listLoadedParsers().find((e) => e.parser.id === id || e.pluginId === id)?.parser;
}

/** Plugin id for a loaded parser, or `parser-<wire>` when not yet mapped. */
export function pluginIdForParser(parser: Parser): string {
  return (
    listLoadedParsers().find((e) => e.parser.id === parser.id)?.pluginId ??
    `${PARSER_ID_PREFIX}${parser.id}`
  );
}

/**
 * Select a parser by exact MIME type, falling back to extension match.
 *
 * Deterministic (r257): exact MIME match wins, then file extension. Multiple
 * hits: later `plugins.load_order` index wins; otherwise plugin id lexicographic.
 * Unmatched inputs return `undefined` so the pipeline can reject with 415.
 */
export function selectParser(mimeType?: string, filename?: string): Parser | undefined {
  const loaded = listLoadedParsers();
  if (mimeType) {
    const mimeHits = loaded.filter((e) => e.parser.mimeTypes.includes(mimeType));
    const picked = pickParser(mimeHits);
    if (picked) return picked;
  }

  if (filename) {
    const ext = filename.toLowerCase().includes('.')
      ? filename.toLowerCase().slice(filename.lastIndexOf('.'))
      : '';
    const extHits = loaded.filter((e) => e.parser.extensions.includes(ext));
    const picked = pickParser(extHits);
    if (picked) return picked;
  }

  return undefined;
}

/** Guess MIME type from file extension. */
export function guessMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    html: 'text/html',
    htm: 'text/html',
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[ext] ?? 'application/octet-stream';
}
