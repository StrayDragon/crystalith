// Source ingestion pipeline.
//
// Handles the full flow: file upload → detect MIME → select parser → parse
// → create source record → chunk → (embed in c05) → mark ready.
//
// The pipeline is intentionally synchronous (no job queue for desktop MVP);
// it runs in-process. The caller should wrap in a try/catch for error handling.
import { eq } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { chunks, sources } from '../../db/schema.ts';
import { bumpSourcesEpoch } from '../../rag/cache.ts';
import { chunkText } from '../../rag/chunker.ts';
import { guessMimeType, registerParser, selectParser } from './parser-registry.ts';
import { htmlParser } from './parsers/html.ts';
import { pdfParser } from './parsers/pdf.ts';
import { textParser } from './parsers/text.ts';

// ---------------------------------------------------------------------------
// Bootstrap: register built-in parsers once at module import.
// ---------------------------------------------------------------------------

registerParser(pdfParser);
registerParser(htmlParser);
registerParser(textParser);

/** Async trigger: index source chunks via embed strategy (fire-and-forget). */
async function triggerEmbedding(sourceId: number, notebookId: number): Promise<void> {
  // Lazy import to avoid circular dependency with AI runtime at module load.
  const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
  const strategy = new EmbedStrategy();
  await strategy.indexSource(sourceId, notebookId);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IngestInput {
  /** File content as raw bytes. */
  buffer: Uint8Array;
  /** Original filename (used for MIME detection and fallback parser selection). */
  filename: string;
  /** Notebook to associate the source with. */
  notebookId: number;
  /** Optional explicit MIME type override. */
  mimeType?: string;
  /** Optional explicit parser override. */
  parserType?: string;
}

export interface IngestResult {
  sourceId: number;
  chunkCount: number;
  text: string;
  parserType: string;
  status: 'ready' | 'failed';
  errorCode?: string;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Process a file through the full ingestion pipeline.
 * Steps:
 *  1. Detect MIME type + select parser
 *  2. Create source record (processing)
 *  3. Parse file contents
 *  4. Chunk parsed text
 *  5. Insert chunk rows
 *  6. Mark source as ready (or failed)
 */
export async function ingestSource(input: IngestInput): Promise<IngestResult> {
  const mimeType = input.mimeType ?? guessMimeType(input.filename);
  const parser = input.parserType
    ? selectParser(input.parserType)
    : selectParser(mimeType, input.filename);

  // 1. Create source record in 'processing' state
  const sourceRow = db()
    .insert(sources)
    .values({
      notebookId: input.notebookId,
      filename: input.filename,
      mimeType,
      parserType: parser?.id ?? 'text',
      status: 'processing',
    })
    .returning()
    .get();

  // New source invalidates cached retrievals for this notebook.
  bumpSourcesEpoch(input.notebookId);

  try {
    // 2. Parse
    const result = await parser!.parse(input.buffer, input.filename);

    // 3. Chunk the text using the v1-aligned chunker (800 chars / 100 overlap).
    const chunked = chunkText(result.text);

    // 4. Insert chunk rows
    let offset = 0;
    for (const c of chunked) {
      db()
        .insert(chunks)
        .values({
          sourceId: sourceRow.id,
          chunkIndex: c.index,
          text: c.text,
          startOffset: offset,
          endOffset: offset + c.text.length,
          metadata: result.metadata ?? null,
        })
        .run();
      offset += c.text.length + 1; // +1 for the separator
    }

    // 5. Mark ready
    db()
      .update(sources)
      .set({
        status: 'ready',
        metadata: result.metadata ?? null,
      })
      .where(eq(sources.id, sourceRow.id))
      .run();

    // 6. Trigger embedding asynchronously (fire-and-forget)
    //    Do not block the upload response — embedding runs in background.
    triggerEmbedding(sourceRow.id, sourceRow.notebookId).catch((error) => {
      console.error(`[pipeline] embedding failed for source ${sourceRow.id}:`, error);
    });

    return {
      sourceId: sourceRow.id,
      chunkCount: chunked.length,
      text: result.text,
      parserType: parser?.id ?? 'text',
      status: 'ready',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    db()
      .update(sources)
      .set({
        status: 'failed',
        errorCode: 'PARSE_ERROR',
        errorMessage: message,
        lastErrorAt: new Date(),
      })
      .where(eq(sources.id, sourceRow.id))
      .run();

    return {
      sourceId: sourceRow.id,
      chunkCount: 0,
      text: '',
      parserType: parser?.id ?? 'text',
      status: 'failed',
      errorCode: 'PARSE_ERROR',
      errorMessage: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Chunking is handled by rag/chunker.ts (v1-aligned 800/100 sliding window).
// ---------------------------------------------------------------------------
