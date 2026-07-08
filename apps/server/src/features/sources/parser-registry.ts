// Parser registry — maps MIME types to parser modules.
//
// Registered parsers (PDF/HTML/Plain text) and utility to detect MIME type
// from file extension/magic bytes and select the right parser.
export interface ParsePage {
  text: string;
  metadata?: { page?: number };
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

/** Select a parser by MIME type, falling back to extension match. */
export function selectParser(mimeType?: string, filename?: string): Parser | undefined {
  // Try exact MIME match
  if (mimeType) {
    for (const parser of registry.values()) {
      if (parser.mimeTypes.includes(mimeType)) return parser;
    }
    // Try prefix match (e.g. "text/" matches text/plain, text/html, etc.)
    for (const parser of registry.values()) {
      if (parser.mimeTypes.some((m) => mimeType.startsWith(m.split('/')[0] + '/'))) return parser;
    }
  }

  // Try file extension
  if (filename) {
    const ext = filename.toLowerCase().includes('.')
      ? filename.toLowerCase().slice(filename.lastIndexOf('.'))
      : '';
    for (const parser of registry.values()) {
      if (parser.extensions.includes(ext)) return parser;
    }
  }

  // Default: text parser
  return registry.get('text');
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
