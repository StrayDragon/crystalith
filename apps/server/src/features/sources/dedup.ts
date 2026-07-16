// Source deduplication — sha256-based dedup_key computation and dedup_action
// flow. Mirrors v1 features/sources/api_ingest.py:338-378 + 771-793.
import { createHash } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { sources } from '../../db/schema.ts';
import { canonicalizeUrlForDedup } from '../../shared/net/url-normalize.ts';

// ---------------------------------------------------------------------------
// Dedup key computation
// ---------------------------------------------------------------------------

/** Compute a content-based dedup key for uploaded file bytes. */
export function uploadDedupKey(rawBytes: Uint8Array): string {
  const hash = createHash('sha256').update(rawBytes).digest('hex');
  return `upload:sha256:${hash}`;
}

/** Compute a URL-based dedup key (canonicalized to eliminate tracking-noise variation). */
export function urlDedupKey(url: string): string {
  const canonical = canonicalizeUrlForDedup(url);
  const hash = createHash('sha256').update(canonical).digest('hex');
  return `url:sha256:${hash}`;
}

// ---------------------------------------------------------------------------
// Dedup action
// ---------------------------------------------------------------------------

export type DedupAction = 'prompt' | 'reuse' | 'create_new';

export interface DedupHit {
  hit: true;
  existingSourceId: number;
}

export interface DedupMiss {
  hit: false;
}

export type DedupResult = DedupHit | DedupMiss;

/**
 * Check whether a source with the given dedup_key already exists in the
 * notebook. Returns the existing source id on hit (so the router can return
 * 409 / reuse), or { hit: false } otherwise.
 */
export function checkDedup(notebookId: number, dedupKey: string): DedupResult {
  const existing = db()
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.notebookId, notebookId), eq(sources.dedupKey, dedupKey)))
    .get();

  if (existing) {
    return { hit: true, existingSourceId: existing.id };
  }
  return { hit: false };
}

/** Resolve dedup_action: returns the existing source id for reuse, undefined otherwise. */
export function resolveDedupAction(
  notebookId: number,
  dedupKey: string,
  action: DedupAction,
): { existingSourceId: number } | undefined {
  const dedupResult = checkDedup(notebookId, dedupKey);

  if (dedupResult.hit) {
    if (action === 'reuse') {
      return { existingSourceId: dedupResult.existingSourceId };
    }
    // 'prompt' → caller throws 409; 'create_new' → ignore
    if (action === 'prompt') {
      // caller must check
      return { existingSourceId: dedupResult.existingSourceId };
    }
  }

  return undefined;
}
