// Output auto-indexing (c132 r485): every persisted outputs row is indexed
// into the search surfaces as a HIDDEN derived source row, synchronously —
// the generation response returning means the output is already searchable
// (“准确不惊诧”). Embedding failure never fails the generation: the derived
// row is marked failed + observable via search-index status
// (derivedFailedCount); an index rebuild recovers it.
import { and, eq } from 'drizzle-orm';

import { insertChunk } from '../../db/chunks.ts';
import { client, db } from '../../db/index.ts';
import { sources } from '../../db/schema.ts';
import { deleteSourceVectors } from '../../db/vectors.ts';
import { bumpSourcesEpoch } from '../../rag/cache.ts';
import { logger } from '../../shared/logger.ts';
import { renderOutputToMarkdown, splitTextToChunks } from './render.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface IndexableOutput {
  id: number;
  notebookId: number;
  type: string;
  prompt: string | null;
  content: unknown;
}

/**
 * Delete the derived container rows of an output (vectors explicitly, chunks
 * via FK cascade + FTS trigger). Idempotent; no-op when none exist.
 */
export async function deleteDerivedSources(notebookId: number, outputId: number): Promise<void> {
  const rows = await client().all(
    db()
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.derivedOutputId, outputId), eq(sources.notebookId, notebookId))),
  );
  for (const r of rows) {
    await deleteSourceVectors(db(), r.id);
    await client().run(db().delete(sources).where(eq(sources.id, r.id)));
  }
}

/**
 * Index one output for search: hidden derived source row + origin-generalized
 * chunks + synchronous embed. Failure marks the derived row failed (never
 * throws — generation has already succeeded at this point).
 */
export async function indexOutputForSearch(row: IndexableOutput): Promise<void> {
  try {
    await deleteDerivedSources(row.notebookId, row.id);

    // Same rendering as the manual convert-to-source path: type-aware
    // markdown, then paragraph+sentence-aware 500/50 chunks.
    const markdown = renderOutputToMarkdown(
      row.type,
      isRecord(row.content) ? row.content : null,
      row.prompt,
    );
    const chunkTexts = splitTextToChunks(markdown, 500, 50);
    if (chunkTexts.length === 0) return;

    const derived = (await client().get(
      db()
        .insert(sources)
        .values({
          notebookId: row.notebookId,
          filename: `${row.type}-${row.id}`,
          mimeType: 'text/markdown',
          parserType: 'text',
          status: 'processing',
          derivedOutputId: row.id,
        })
        .returning(),
    ))!;

    let i = 0;
    for (const text of chunkTexts) {
      await insertChunk({
        sourceId: derived.id,
        chunkIndex: i++,
        text,
        originType: 'output',
        originId: row.id,
      });
    }

    try {
      const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
      await new EmbedStrategy().indexSource(derived.id, row.notebookId);
      await client().run(
        db().update(sources).set({ status: 'ready' }).where(eq(sources.id, derived.id)),
      );
    } catch (error) {
      logger.error('[outputs] auto-index embed failed:', error);
      await client().run(
        db()
          .update(sources)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : String(error),
            errorCode: 'EMBEDDING_FAILED',
          })
          .where(eq(sources.id, derived.id)),
      );
    }
  } catch (error) {
    // Even the container-row creation failed — log and keep the generation.
    logger.error('[outputs] auto-index failed:', error);
  } finally {
    bumpSourcesEpoch(row.notebookId);
  }
}
