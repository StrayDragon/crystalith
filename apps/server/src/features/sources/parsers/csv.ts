// CSV parser — produces markdown-table chunks with row metadata.
//
// c46: ports v1 parsers/csv.py — 50 rows/chunk, 200 char cell truncation,
// csv_row_start/csv_row_end metadata per chunk.
// c46-fix: returns pages[] so the pipeline can create per-chunk rows with
// individual metadata (instead of re-chunking via generic chunkText).
import type { Parser, ParseResult } from '../parser-registry.ts';

const MAX_ROWS_PER_CHUNK = 50;
const MAX_CELL_CHARS = 200;

/** Parse CSV text into rows (handles quoted fields with commas/newlines). */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        // Handle \r\n
        if (char === '\r' && text[i + 1] === '\n') i++;
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.length > 0 && currentRow.some((f) => f !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }
  // Last field
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * c53: escape a cell for markdown-table safety (v1 csv.py:61-67).
 * Pipes become \|, newlines become spaces. MUST run before truncation.
 */
function escapeCell(cell: string): string {
  return cell.replaceAll('|', '\\|').replaceAll(/\r?\n/g, ' ');
}

/** c53: truncate a cell to MAX_CELL_CHARS using the … ellipsis (v1 csv.py:66). */
function truncateCell(cell: string): string {
  return cell.length > MAX_CELL_CHARS ? cell.slice(0, MAX_CELL_CHARS) + '…' : cell;
}

/** c53: escape + truncate, in that order (v1 csv.py:61-67). */
function formatCell(cell: string): string {
  return truncateCell(escapeCell(cell));
}

/** Convert rows to a markdown table string. */
function rowsToMarkdownTable(header: string[], rows: string[][]): string {
  const headerLine = `| ${header.map(formatCell).join(' | ')} |`;
  const separator = `| ${header.map(() => '---').join(' | ')} |`;
  const dataLines = rows.map((row) => `| ${row.map((c) => formatCell(c ?? '')).join(' | ')} |`);
  return [headerLine, separator, ...dataLines].join('\n');
}

export const csvParser: Parser = {
  id: 'csv',
  name: 'CSV Parser',
  mimeTypes: ['text/csv'],
  extensions: ['.csv'],
  async parse(buf: Uint8Array, _filename?: string): Promise<ParseResult> {
    const text = new TextDecoder().decode(buf);
    if (!text.trim()) return { text: '', metadata: { parser: 'csv' } };

    const rows = parseCsvRows(text);
    if (rows.length === 0) return { text: '', metadata: { parser: 'csv' } };

    // Normalize header (empty column names → col{N})
    const rawHeader = rows[0]!;
    const header = rawHeader.map((cell, index) => {
      const name = (cell ?? '').trim();
      return name || `col${index + 1}`;
    });

    const dataRows = rows.slice(1);

    // Chunk into groups of MAX_ROWS_PER_CHUNK — each becomes a page with
    // csv_row_start/csv_row_end metadata (v1 csv.py:48-55).
    const pages: { text: string; metadata: Record<string, unknown> }[] = [];
    for (let start = 0; start < dataRows.length; start += MAX_ROWS_PER_CHUNK) {
      const end = Math.min(dataRows.length, start + MAX_ROWS_PER_CHUNK);
      const block = dataRows.slice(start, end);
      const tableText = rowsToMarkdownTable(header, block);
      pages.push({
        text: tableText,
        metadata: {
          csv_row_start: start + 1, // 1-based (v1)
          csv_row_end: end,
        },
      });
    }

    // Also set full text + top-level metadata for backward compat
    return {
      text: pages.map((p) => p.text).join('\n\n'),
      pages,
      metadata: {
        parser: 'csv',
        row_count: dataRows.length,
        column_count: header.length,
        chunk_count: pages.length,
      },
    };
  },
};
