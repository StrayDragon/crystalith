// CSV parser — produces markdown-table chunks with row metadata.
//
// c46: ports v1 parsers/csv.py — 50 rows/chunk, 200 char cell truncation,
// csv_row_start/csv_row_end metadata. Replaces the previous text pass-through.
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

/** Truncate a cell to MAX_CELL_CHARS. */
function truncateCell(cell: string): string {
  return cell.length > MAX_CELL_CHARS ? cell.slice(0, MAX_CELL_CHARS) + '...' : cell;
}

/** Convert rows to a markdown table string. */
function rowsToMarkdownTable(header: string[], rows: string[][]): string {
  const headerLine = `| ${header.map(truncateCell).join(' | ')} |`;
  const separator = `| ${header.map(() => '---').join(' | ')} |`;
  const dataLines = rows.map(
    (row) => `| ${row.map((c) => truncateCell(c ?? '')).join(' | ')} |`,
  );
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

    // Chunk into groups of MAX_ROWS_PER_CHUNK
    const chunks: string[] = [];
    for (let i = 0; i < dataRows.length; i += MAX_ROWS_PER_CHUNK) {
      const chunkRows = dataRows.slice(i, i + MAX_ROWS_PER_CHUNK);
      const table = rowsToMarkdownTable(header, chunkRows);
      chunks.push(table);
    }

    const fullText = chunks.join('\n\n');

    return {
      text: fullText,
      metadata: {
        parser: 'csv',
        row_count: dataRows.length,
        column_count: header.length,
        chunk_count: chunks.length,
      },
    };
  },
};
