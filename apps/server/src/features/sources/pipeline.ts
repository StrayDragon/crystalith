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
import { contentStorage } from '../../shared/storage.ts';
import { guessMimeType, registerParser, selectParser } from './parser-registry.ts';
import { csvParser } from './parsers/csv.ts';
import { htmlParser } from './parsers/html.ts';
import { pdfParser } from './parsers/pdf.ts';
import { textParser } from './parsers/text.ts';

// ---------------------------------------------------------------------------
// Bootstrap: register built-in parsers once at module import.
// ---------------------------------------------------------------------------

registerParser(pdfParser);
registerParser(htmlParser);
registerParser(csvParser); // c46: CSV before text so it takes precedence
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
  /** Dedup key (pre-computed by caller). */
  dedupKey?: string;
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
      dedupKey: input.dedupKey ?? null,
    })
    .returning()
    .get();

  // New source invalidates cached retrievals for this notebook.
  bumpSourcesEpoch(input.notebookId);

  // Persist raw bytes so document_parse can re-parse later (fire-and-forget
  // best-effort: a failed save is logged, not fatal — parsing still works).
  contentStorage.save(sourceRow.id, input.buffer).catch((error) => {
    console.error(`[pipeline] contentStorage.save failed for source ${sourceRow.id}:`, error);
  });

  let stage: 'parse' | 'embed' = 'parse';
  try {
    // 2. Parse
    const result = await parser!.parse(input.buffer, input.filename);

    // 3. Chunk: use parser-provided pages (per-chunk metadata like csv_row_start)
    //    when available; otherwise fall back to the generic chunker.
    const chunked: Array<{ index: number; text: string; metadata?: Record<string, unknown> }> =
      result.pages && result.pages.length > 0
        ? result.pages.map((p, i) => ({
            index: i,
            text: p.text,
            metadata: p.metadata,
          }))
        : chunkText(result.text).map((c) => ({ index: c.index, text: c.text }));

    // 4. Insert chunk rows
    let offset = 0;
    for (const c of chunked) {
      const chunkMetadata = c.metadata ?? result.metadata ?? null;
      db()
        .insert(chunks)
        .values({
          sourceId: sourceRow.id,
          chunkIndex: c.index,
          text: c.text,
          startOffset: offset,
          endOffset: offset + c.text.length,
          metadata: chunkMetadata as Record<string, unknown> | null,
        })
        .run();
      offset += c.text.length + 1; // +1 for the separator
    }

    // 5. Embed synchronously — vectors MUST exist before marking ready (c30).
    //    v1 awaits the full parse→embed→vector_store sequence before returning.
    stage = 'embed';
    await triggerEmbedding(sourceRow.id, sourceRow.notebookId);

    // 6. Mark ready (only after vectors are written)
    db()
      .update(sources)
      .set({
        status: 'ready',
        metadata: result.metadata ?? null,
      })
      .where(eq(sources.id, sourceRow.id))
      .run();

    return {
      sourceId: sourceRow.id,
      chunkCount: chunked.length,
      text: result.text,
      parserType: parser?.id ?? 'text',
      status: 'ready',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = stage === 'embed' ? 'EMBEDDING_FAILED' : 'PARSE_ERROR';
    db()
      .update(sources)
      .set({
        status: 'failed',
        errorCode,
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
      errorCode,
      errorMessage: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Chunking is handled by rag/chunker.ts (v1-aligned 800/100 sliding window).
// ---------------------------------------------------------------------------
