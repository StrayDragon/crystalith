// Markdown semantic preprocessing (r287/r464/r465) — runs between parse and
// chunk for text/markdown uploads.
//
// - Wikilinks:  [[target|alias]] → [alias](target), [[target]] → [target](target)
// - Embeds:     ![[img.png]]     → ![img.png](img.png) for image extensions
//               ![[note]]        → [note](note)   (retrievable text reference)
// - Frontmatter: a leading `---` YAML block has its supported fields
//               (title/tags/aliases/date) extracted to source metadata and
//               the block stripped so it never pollutes chunks.
//
// Zero-disturbance guarantee: input without frontmatter and without wikilinks
// passes through byte-identical.
import { logger } from '../../shared/logger.ts';

/** File extensions treated as image embeds (![[x.png]] → markdown image). */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']);

export interface MarkdownFrontmatter {
  title?: string;
  tags?: string[];
  aliases?: string[];
  date?: string;
}

export interface MarkdownPreprocessResult {
  text: string;
  frontmatter: MarkdownFrontmatter | null;
}

/** Strip one outer level of inline-code fencing so link syntax inside `code`
 * spans isn't transformed. Minimal protection: we only skip transforms inside
 * fenced code blocks (``` ... ```), which is where wikilink-looking text most
 * commonly appears in practice. */
function transformWikilinks(text: string): string {
  const segments = text.split(/(```[\s\S]*?```)/gu);
  return segments
    .map((segment) => {
      if (segment.startsWith('```')) return segment;
      return (
        segment
          // Embeds first (they are a superset pattern): ![[target|alias]] / ![[target]]
          .replaceAll(/!\[\[([^\]|]+)\|([^\]]+)\]\]/gu, (_m, target: string, alias: string) =>
            isImageRef(target)
              ? `![${alias.trim()}](${target.trim()})`
              : `[${alias.trim()}](${target.trim()})`,
          )
          .replaceAll(/!\[\[([^\]]+)\]\]/gu, (_m, target: string) =>
            isImageRef(target)
              ? `![${target.trim()}](${target.trim()})`
              : `[${target.trim()}](${target.trim()})`,
          )
          // Plain links: [[target|alias]] / [[target]]
          .replaceAll(
            /\[\[([^\]|]+)\|([^\]]+)\]\]/gu,
            (_m, target: string, alias: string) => `[${alias.trim()}](${target.trim()})`,
          )
          .replaceAll(
            /\[\[([^\]]+)\]\]/gu,
            (_m, target: string) => `[${target.trim()}](${target.trim()})`,
          )
      );
    })
    .join('');
}

function isImageRef(target: string): boolean {
  const ext = target.trim().toLowerCase().split('.').pop() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
}

/** Parse a scalar value from a frontmatter line (bare string, quoted, inline array). */
function parseScalar(raw: string): string | string[] {
  const value = raw.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => item.trim().replaceAll(/^['"]|['"]$/gu, ''));
  }
  return value.replaceAll(/^['"]|['"]$/gu, '');
}

/** Parse the supported subset of YAML frontmatter (r465). Tolerant by design. */
function parseFrontmatter(block: string): MarkdownFrontmatter | null {
  const result: MarkdownFrontmatter = {};
  const lines = block.split('\n');
  let currentListKey: 'tags' | 'aliases' | null = null;
  for (const line of lines) {
    const listItem = line.match(/^\s*-\s+(.+)$/u);
    if (listItem && currentListKey) {
      const list = result[currentListKey] ?? [];
      list.push(listItem[1].trim().replaceAll(/^['"]|['"]$/gu, ''));
      result[currentListKey] = list;
      continue;
    }
    currentListKey = null;
    const pair = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/u);
    if (!pair) continue;
    const key = pair[1].toLowerCase();
    const raw = pair[2].trim();
    if (key === 'title' && raw) {
      result.title = String(parseScalar(raw));
    } else if (key === 'date' && raw) {
      result.date = String(parseScalar(raw));
    } else if (key === 'tags' || key === 'aliases') {
      currentListKey = key;
      if (raw) {
        const parsed = parseScalar(raw);
        result[key] = Array.isArray(parsed) ? parsed : [parsed];
      }
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** Split a leading frontmatter block off the text. Returns null when absent. */
function splitFrontmatter(text: string): { frontmatter: string; rest: string } | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u);
  if (!match) return null;
  return { frontmatter: match[1], rest: text.slice(match[0].length) };
}

/**
 * Preprocess a markdown document: normalize wikilinks/embeds and extract the
 * frontmatter block. `rest` (frontmatter stripped, wikilinks normalized) is
 * what enters the chunker.
 */
export function preprocessMarkdown(text: string): MarkdownPreprocessResult {
  let working = text;
  let frontmatter: MarkdownFrontmatter | null = null;
  const split = splitFrontmatter(working);
  if (split) {
    const parsed = parseFrontmatter(split.frontmatter);
    if (parsed) {
      frontmatter = parsed;
      working = split.rest;
    } else {
      // Unparseable frontmatter: keep the block in the content rather than
      // silently dropping it (zero-disturbance for unknown shapes).
      logger.debug('[markdown-preprocess] frontmatter present but no supported fields');
    }
  }
  const withLinks = transformWikilinks(working);
  return { text: withLinks, frontmatter };
}
