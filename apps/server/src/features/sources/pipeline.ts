// Source ingestion pipeline.
//
// Handles the full flow: file upload → detect MIME → select parser → parse
// → create source record → chunk → (embed in c05) → mark ready.
//
// The pipeline is intentionally synchronous (no job queue for desktop MVP);
// it runs in-process. The caller should wrap in a try/catch for error handling.
import { eq } from 'drizzle-orm';

import { insertChunk } from '../../db/chunks.ts';
import { client, db } from '../../db/index.ts';
import { sources } from '../../db/schema.ts';
import { bumpSourcesEpoch } from '../../rag/cache.ts';
import { chunkText } from '../../rag/chunker.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { logger } from '../../shared/logger.ts';
import { contentStorage } from '../../shared/storage.ts';
import { preprocessMarkdown } from './markdown-preprocess.ts';
import type { Parser } from './parser-registry.ts';
import { guessMimeType, getParser, registerParser, selectParser } from './parser-registry.ts';
import { csvParser } from './parsers/csv.ts';
import { htmlParser } from './parsers/html.ts';
import { pdfParser } from './parsers/pdf.ts';
import { textParser } from './parsers/text.ts';

/** r287 scope guard: markdown preprocessing applies to text/markdown inputs. */
function isMarkdownDocument(mimeType: string, filename: string): boolean {
  if (mimeType === 'text/markdown' || mimeType === 'text/x-markdown') return true;
  return /\.md(?:own)?$/iu.test(filename);
}

// ---------------------------------------------------------------------------
// Bootstrap: register built-in parsers once at module import.
// ---------------------------------------------------------------------------

registerParser(pdfParser);
registerParser(htmlParser);
// c46: CSV before text so it takes precedence
registerParser(csvParser);
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
 * Deterministic input prechecks (r258/r290): parser resolution + empty-input
 * rejection. Pure — no DB writes — so callers that destroy state before
 * ingest (r491 replace deletes the old source first) can rule out
 * certain-failure inputs before doing so. Returns the resolved parser for
 * reuse by ingestSource.
 */
export function precheckIngestInput(input: {
  filename: string;
  buffer: Uint8Array;
  mimeType?: string;
  parserType?: string;
}): Parser {
  const mimeType = input.mimeType ?? guessMimeType(input.filename);
  // r257: explicit parserType overrides resolve by registry id; otherwise
  // deterministic exact-MIME → extension selection. Unmatched inputs are
  // rejected (r258/r295) instead of silently mis-parsed.
  const parser = input.parserType
    ? getParser(input.parserType)
    : selectParser(mimeType, input.filename);
  if (!parser) {
    const ext = input.filename.toLowerCase().includes('.')
      ? input.filename.toLowerCase().slice(input.filename.lastIndexOf('.') + 1)
      : '';
    throw new AppHttpError(
      ErrorCode.UNSUPPORTED_MEDIA_TYPE,
      `Unsupported file type: ${mimeType}${ext ? ` (.${ext})` : ''}`,
      {
        mimeType,
        filename: input.filename,
        ...(ext ? { pluginHint: `parser-${ext}` } : {}),
      },
    );
  }

  // r290: deterministic input errors MUST 400 without creating a source row —
  // reject empty uploads before any insert.
  if (input.buffer.length === 0) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Empty file');
  }
  return parser;
}

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
  const parser = precheckIngestInput(input);

  // 1. Create source record in 'processing' state
  const sourceRow = (await client().get(
    db()
      .insert(sources)
      .values({
        notebookId: input.notebookId,
        filename: input.filename,
        mimeType,
        parserType: parser.id,
        status: 'processing',
        dedupKey: input.dedupKey ?? null,
      })
      .returning(),
  ))!;

  // New source invalidates cached retrievals for this notebook.
  bumpSourcesEpoch(input.notebookId);

  // Persist raw bytes so document_parse can re-parse later (fire-and-forget
  // best-effort: a failed save is logged, not fatal — parsing still works).
  contentStorage.save(sourceRow.id, input.buffer).catch((error) => {
    logger.error(`[pipeline] contentStorage.save failed for source ${sourceRow.id}:`, error);
  });

  // c57: 4-stage error tracking (v1 api_ingest.py:893-924):
  // PARSE_ERROR → EMBEDDING_FAILED → VECTOR_STORE_FAILED → INGESTION_FAILED
  let stage: 'parse' | 'embed' | 'vector_store' | 'ingestion' = 'parse';
  try {
    // 2. Parse
    const result = await parser!.parse(input.buffer, input.filename);

    // r287/r464/r465: markdown semantic preprocessing (wikilink normalization
    // + frontmatter extraction) runs before chunk/embed/store; extracted
    // fields land in source.metadata.frontmatter and never enter chunks.
    let markdownFrontmatter: import('./markdown-preprocess.ts').MarkdownFrontmatter | null = null;
    let textForChunks = result.text;
    if (isMarkdownDocument(mimeType, input.filename) && result.text) {
      const pre = preprocessMarkdown(result.text);
      textForChunks = pre.text;
      markdownFrontmatter = pre.frontmatter;
    }

    // 3. Chunk: use parser-provided pages (per-chunk metadata like csv_row_start)
    //    when available; otherwise fall back to the generic chunker.
    const chunked: Array<{ index: number; text: string; metadata?: Record<string, unknown> }> =
      result.pages && result.pages.length > 0
        ? result.pages.map((p, i) => ({
            index: i,
            text: p.text,
            metadata: p.metadata,
          }))
        : chunkText(textForChunks).map((c) => ({ index: c.index, text: c.text }));

    // r290: no indexable content is a deterministic input error — roll back the
    // processing row (and best-effort the saved bytes) and 400, leaving no source.
    const hasPages = (result.pages?.length ?? 0) > 0;
    if (chunked.length === 0 || (!hasPages && !textForChunks.trim())) {
      await client().run(db().delete(sources).where(eq(sources.id, sourceRow.id)));
      await contentStorage.delete(sourceRow.id).catch((error) => {
        logger.warn(`[pipeline] contentStorage cleanup failed for source ${sourceRow.id}:`, error);
      });
      throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'No indexable content');
    }

    // 4. Insert chunk rows
    let offset = 0;
    for (const c of chunked) {
      const chunkMetadata = c.metadata ?? result.metadata ?? null;
      await insertChunk({
        sourceId: sourceRow.id,
        chunkIndex: c.index,
        text: c.text,
        startOffset: offset,
        endOffset: offset + c.text.length,
        metadata: chunkMetadata,
      });
      // +1 for the separator
      offset += c.text.length + 1;
    }

    // 5. Embed synchronously — vectors MUST exist before marking ready (c30).
    //    v1 awaits the full parse→embed→vector_store sequence before returning.
    //    c57: embed stage covers both embedBatch + insertChunkVector inside
    //    triggerEmbedding (they're not separable without refactoring the
    //    EmbedStrategy). VECTOR_STORE_FAILED is reserved for future split.
    stage = 'embed';
    await triggerEmbedding(sourceRow.id, sourceRow.notebookId);

    // 6. Mark ready (only after vectors are written)
    const readyMetadata: Record<string, unknown> = {
      ...(result.metadata as Record<string, unknown>),
    };
    if (markdownFrontmatter) readyMetadata.frontmatter = markdownFrontmatter;
    await client().run(
      db()
        .update(sources)
        .set({
          status: 'ready',
          metadata: readyMetadata,
        })
        .where(eq(sources.id, sourceRow.id)),
    );

    // c74: async auto-summary after ready (must not block ingest response)
    const { scheduleSourceSummary } = await import('./source-summary.ts');
    scheduleSourceSummary(sourceRow.id);

    return {
      sourceId: sourceRow.id,
      chunkCount: chunked.length,
      text: result.text,
      parserType: parser.id,
      status: 'ready',
    };
  } catch (error) {
    // r290: deterministic input errors are client-facing 400s — rethrow instead
    // of classifying them as a pipeline stage failure.
    if (error instanceof AppHttpError) throw error;
    const message = error instanceof Error ? error.message : 'Unknown error';
    // c57: 4-stage error classification (v1 api_ingest.py:893-924)
    const errorCode =
      stage === 'parse'
        ? 'PARSE_ERROR'
        : stage === 'embed'
          ? 'EMBEDDING_FAILED'
          : stage === 'vector_store'
            ? 'VECTOR_STORE_FAILED'
            : 'INGESTION_FAILED';
    // c57: recovery hints (v1-style, per-stage guidance)
    const recoveryHints: Record<string, string> = {
      PARSE_ERROR: '请检查文件格式是否受支持，或尝试转换为 PDF/HTML/TXT/CSV 格式',
      EMBEDDING_FAILED: '请检查 embedding 模型配置是否正确，或尝试 re-embed',
      VECTOR_STORE_FAILED: '向量存储写入失败，请检查 sqlite-vec 扩展是否正常加载',
      INGESTION_FAILED: '摄取流程发生未知错误，请重试或检查日志',
    };
    await client().run(
      db()
        .update(sources)
        .set({
          status: 'failed',
          errorCode,
          errorMessage: message,
          recoveryHint: recoveryHints[errorCode] ?? null,
          lastErrorAt: new Date(),
        })
        .where(eq(sources.id, sourceRow.id)),
    );

    return {
      sourceId: sourceRow.id,
      chunkCount: 0,
      text: '',
      parserType: parser.id,
      status: 'failed',
      errorCode,
      errorMessage: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Chunking is handled by rag/chunker.ts (v1-aligned 800/100 sliding window).
// ---------------------------------------------------------------------------
