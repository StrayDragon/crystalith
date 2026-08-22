import { SourceTagBindingRequestSchema, type SourceTag } from '@crystalith/shared';
// Source tag service — tag CRUD + source↔tag bindings (c39/c53/c57).
//
// Extracted from router.ts to keep the HTTP layer thin.
// Wire semantics preserved: case-insensitive uniqueness (409 CONFLICT),
// idempotent assign/remove with per-item diagnostics (v1 api_tags.py).
import { and, eq } from 'drizzle-orm';
import { NotFoundError } from 'elysia';
import type { z } from 'zod';

import { db } from '../../db/index.ts';
import { sources, sourceTagMap, sourceTags } from '../../db/schema.ts';
import { bumpSourcesEpoch } from '../../rag/cache.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';

type TagBindingRequest = z.infer<typeof SourceTagBindingRequestSchema>;

type TagRow = typeof sourceTags.$inferSelect;

function toTagDto(row: TagRow): SourceTag {
  return {
    id: row.id,
    notebookId: row.notebookId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function requireTagName(name: string): string {
  const rawName = name.trim().slice(0, 64);
  if (!rawName) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Tag name is required');
  }
  return rawName;
}

function findConflict(nid: number, rawName: string, excludeTagId?: number): TagRow | undefined {
  return db()
    .select()
    .from(sourceTags)
    .where(eq(sourceTags.notebookId, nid))
    .all()
    .find((t) => t.id !== excludeTagId && t.name.toLowerCase() === rawName.toLowerCase());
}

/** List all tags in a notebook. */
export function listNotebookTags(nid: number): SourceTag[] {
  return db().select().from(sourceTags).where(eq(sourceTags.notebookId, nid)).all().map(toTagDto);
}

/** Create a tag; case-insensitive uniqueness within the notebook (v1 api_tags.py:56-63). */
export function createTag(nid: number, name: string): SourceTag {
  const rawName = requireTagName(name);
  const existing = findConflict(nid, rawName);
  if (existing) {
    throw new AppHttpError(ErrorCode.CONFLICT, 'Tag name already exists', {
      existingTagId: existing.id,
    });
  }
  const row = db().insert(sourceTags).values({ notebookId: nid, name: rawName }).returning().get();
  // c57: invalidate sources cache (list-sources cache key includes tag filter)
  bumpSourcesEpoch(nid);
  return toTagDto(row);
}

/** Rename a tag; validates ownership and uniqueness excluding self (v1 api_tags.py:81). */
export function renameTag(nid: number, tid: number, name: string): SourceTag {
  const rawName = requireTagName(name);
  const existing = db()
    .select()
    .from(sourceTags)
    .where(and(eq(sourceTags.id, tid), eq(sourceTags.notebookId, nid)))
    .get();
  if (!existing) throw new NotFoundError(`Tag ${tid} not found in notebook ${nid}`);
  const conflict = findConflict(nid, rawName, tid);
  if (conflict) {
    throw new AppHttpError(ErrorCode.CONFLICT, 'Tag name already exists', {
      existingTagId: conflict.id,
    });
  }
  db().update(sourceTags).set({ name: rawName }).where(eq(sourceTags.id, tid)).run();
  // c57: invalidate sources cache
  bumpSourcesEpoch(nid);
  const updated = db().select().from(sourceTags).where(eq(sourceTags.id, tid)).get();
  return toTagDto(updated!);
}

/** Delete a tag and its bindings (ownership checked) (v1 api_tags.py:110). */
export function deleteTag(nid: number, tid: number): void {
  const existing = db()
    .select()
    .from(sourceTags)
    .where(and(eq(sourceTags.id, tid), eq(sourceTags.notebookId, nid)))
    .get();
  if (!existing) throw new NotFoundError(`Tag ${tid} not found in notebook ${nid}`);
  db().delete(sourceTags).where(eq(sourceTags.id, tid)).run();
  // c57: invalidate sources cache
  bumpSourcesEpoch(nid);
}

/** Assign sources to a tag; idempotent with per-item diagnostics. */
export function assignSourcesToTag(nid: number, tid: number, body: TagBindingRequest) {
  const { sourceIds } = body;
  // c53: per-item diagnostics (v1 api_tags.py:142-185 SourceBatchItemResult).
  const results: Array<{
    sourceId: number;
    ok: boolean;
    message?: string;
    errorCode?: string;
  }> = [];
  let applied = 0;
  let skipped = 0;
  for (const sid of sourceIds) {
    const src = db()
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.id, sid), eq(sources.notebookId, nid)))
      .get();
    if (!src) {
      results.push({ sourceId: sid, ok: false, errorCode: 'SOURCE_NOT_FOUND' });
      continue;
    }
    const existing = db()
      .select()
      .from(sourceTagMap)
      .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid)))
      .get();
    if (existing) {
      skipped++;
      results.push({ sourceId: sid, ok: true, message: 'already assigned' });
      continue;
    }
    db().insert(sourceTagMap).values({ sourceId: sid, tagId: tid }).run();
    applied++;
    results.push({ sourceId: sid, ok: true });
  }
  // c57: invalidate sources cache (tag binding changed)
  if (applied > 0) bumpSourcesEpoch(nid);
  return { tagId: tid, sourceIds, applied, skipped, results };
}

/** Remove sources from a tag; reports unassigned as skipped with per-item diagnostics. */
export function removeSourcesFromTag(nid: number, tid: number, body: TagBindingRequest) {
  const { sourceIds } = body;
  // c53: per-item diagnostics (v1 api_tags.py:142-185)
  const results: Array<{
    sourceId: number;
    ok: boolean;
    message?: string;
    errorCode?: string;
  }> = [];
  let removed = 0;
  let skipped = 0;
  for (const sid of sourceIds) {
    const src = db()
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.id, sid), eq(sources.notebookId, nid)))
      .get();
    if (!src) {
      results.push({ sourceId: sid, ok: false, errorCode: 'SOURCE_NOT_FOUND' });
      continue;
    }
    const existing = db()
      .select()
      .from(sourceTagMap)
      .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid)))
      .get();
    if (!existing) {
      skipped++;
      results.push({ sourceId: sid, ok: true, message: 'not assigned' });
      continue;
    }
    db()
      .delete(sourceTagMap)
      .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid)))
      .run();
    removed++;
    results.push({ sourceId: sid, ok: true });
  }
  // c57: invalidate sources cache (tag unbinding changed)
  if (removed > 0) bumpSourcesEpoch(nid);
  return { tagId: tid, sourceIds, removed, skipped, results };
}
