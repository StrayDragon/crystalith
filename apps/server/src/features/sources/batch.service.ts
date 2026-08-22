import {
  SourceBatchDeleteRequestSchema,
  SourceBatchReembedRequestSchema,
} from '@crystalith/shared';
// Source batch operations service — batch delete / batch re-embed (c57).
//
// Extracted from router.ts to keep the HTTP layer thin.
// Wire semantics preserved: per-item diagnostics arrays, never a thrown 404
// for individual missing sources (v1 api_schemas.py:111-114).
import { eq } from 'drizzle-orm';
import type { z } from 'zod';

import { db } from '../../db/index.ts';
import { sources } from '../../db/schema.ts';
import { deleteSourceVectors } from '../../db/vectors.ts';
import { bumpSourcesEpoch } from '../../rag/cache.ts';

type BatchDeleteBody = z.infer<typeof SourceBatchDeleteRequestSchema>;
type BatchReembedBody = z.infer<typeof SourceBatchReembedRequestSchema>;

type BatchItemResult = {
  sourceId: number;
  ok: boolean;
  errorCode?: string;
  message?: string;
};

/** Batch delete sources with vectors; per-item results, never throws per-item (c57). */
export function batchDeleteSources(nid: number, body: BatchDeleteBody) {
  const { sourceIds } = body;
  const deletedIds: number[] = [];
  const results: BatchItemResult[] = [];
  for (const sid of sourceIds) {
    const row = db().select().from(sources).where(eq(sources.id, sid)).get();
    if (row && row.notebookId === nid) {
      deleteSourceVectors(db(), sid);
      db().delete(sources).where(eq(sources.id, sid)).run();
      deletedIds.push(sid);
      results.push({ sourceId: sid, ok: true });
    } else {
      results.push({
        sourceId: sid,
        ok: false,
        errorCode: 'SOURCE_NOT_FOUND',
        message: row ? 'Source not in this notebook' : 'Source not found',
      });
    }
  }
  if (deletedIds.length) bumpSourcesEpoch(nid);
  return { results, deletedIds, deletedCount: deletedIds.length };
}

/**
 * Batch re-embed failed sources; clears ALL error fields before retry and
 * reports EMBEDDING_FAILED per item on failure (v1 api_common.py:261-263).
 */
export async function batchReembedSources(nid: number, body: BatchReembedBody) {
  const { sourceIds } = body;
  const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
  const strategy = new EmbedStrategy();
  const reembedded: number[] = [];
  const failed: number[] = [];
  const results: BatchItemResult[] = [];
  for (const sid of sourceIds) {
    const row = db().select().from(sources).where(eq(sources.id, sid)).get();
    if (!row || row.notebookId !== nid) {
      failed.push(sid);
      results.push({
        sourceId: sid,
        ok: false,
        errorCode: 'SOURCE_NOT_FOUND',
        message: 'Source not found in this notebook',
      });
      continue;
    }
    // c57: clear ALL error fields (v1 api_common.py:261-263)
    db()
      .update(sources)
      .set({
        status: 'processing',
        errorCode: null,
        errorMessage: null,
        recoveryHint: null,
        lastErrorAt: null,
      })
      .where(eq(sources.id, sid))
      .run();
    try {
      deleteSourceVectors(db(), sid);
      await strategy.indexSource(sid, nid);
      db().update(sources).set({ status: 'ready' }).where(eq(sources.id, sid)).run();
      reembedded.push(sid);
      results.push({ sourceId: sid, ok: true });
      const { scheduleSourceSummary } = await import('./source-summary.ts');
      scheduleSourceSummary(sid, { force: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      db()
        .update(sources)
        .set({
          status: 'failed',
          errorCode: 'EMBEDDING_FAILED',
          errorMessage: msg,
        })
        .where(eq(sources.id, sid))
        .run();
      failed.push(sid);
      results.push({ sourceId: sid, ok: false, errorCode: 'EMBEDDING_FAILED', message: msg });
    }
  }
  if (reembedded.length || failed.length) bumpSourcesEpoch(nid);
  return {
    results,
    reembeddedIds: reembedded,
    failedIds: failed,
    reembeddedCount: reembedded.length,
    failedCount: failed.length,
  };
}
