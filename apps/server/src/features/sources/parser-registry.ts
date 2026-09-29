// Parser registry — maps MIME types to parser modules.
//
// Registered parsers (PDF/HTML/Plain text) and utility to detect MIME type
// from file extension/magic bytes and select the right parser.
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

const registry = new Map<string, Parser>();

/** Register a parser. Overwrites if same id already registered. */
export function registerParser(parser: Parser): void {
  registry.set(parser.id, parser);
}

/** Get a registered parser by id. */
export function getParser(id: string): Parser | undefined {
  return registry.get(id);
}

/** Select a parser by exact MIME type, falling back to extension match.
 *
 * Deterministic (r257): exact MIME match wins in registry order, then file
 * extension. No prefix matching and no default fallback — an unmatched input
 * returns `undefined` so the pipeline can reject it with a stable 415
 * (r258/r295) instead of silently feeding it to the wrong parser.
 */
export function selectParser(mimeType?: string, filename?: string): Parser | undefined {
  if (mimeType) {
    for (const parser of registry.values()) {
      if (parser.mimeTypes.includes(mimeType)) return parser;
    }
  }

  if (filename) {
    const ext = filename.toLowerCase().includes('.')
      ? filename.toLowerCase().slice(filename.lastIndexOf('.'))
      : '';
    for (const parser of registry.values()) {
      if (parser.extensions.includes(ext)) return parser;
    }
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
  };
  return map[ext] ?? 'application/octet-stream';
}

/** List all registered parsers. */
export function listParsers(): Parser[] {
  return Array.from(registry.values());
}
