import { SourceTagBindingRequestSchema, type SourceTag } from '@crystalith/shared';
// Source tag service — tag CRUD + source↔tag bindings (c39/c53/c57).
//
// Extracted from router.ts to keep the HTTP layer thin.
// Wire semantics preserved: case-insensitive uniqueness (409 CONFLICT),
// idempotent assign/remove with per-item diagnostics (v1 api_tags.py).
import { and, eq } from 'drizzle-orm';
import { NotFoundError } from 'elysia';
import type { z } from 'zod';

import { client, db } from '../../db/index.ts';
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

async function findConflict(
  nid: number,
  rawName: string,
  excludeTagId?: number,
): Promise<TagRow | undefined> {
  return (
    await client().all(db().select().from(sourceTags).where(eq(sourceTags.notebookId, nid)))
  ).find((t) => t.id !== excludeTagId && t.name.toLowerCase() === rawName.toLowerCase());
}

/** List all tags in a notebook. */
export async function listNotebookTags(nid: number): Promise<SourceTag[]> {
  return (
    await client().all(db().select().from(sourceTags).where(eq(sourceTags.notebookId, nid)))
  ).map(toTagDto);
}

/** Create a tag; case-insensitive uniqueness within the notebook (v1 api_tags.py:56-63). */
export async function createTag(nid: number, name: string): Promise<SourceTag> {
  const rawName = requireTagName(name);
  const existing = await findConflict(nid, rawName);
  if (existing) {
    throw new AppHttpError(ErrorCode.CONFLICT, 'Tag name already exists', {
      existingTagId: existing.id,
    });
  }
  const row = await client().get(
    db().insert(sourceTags).values({ notebookId: nid, name: rawName }).returning(),
  );
  // c57: invalidate sources cache (list-sources cache key includes tag filter)
  bumpSourcesEpoch(nid);
  // insert-returning always yields a row; drizzle's sync .get() typed it non-null
  return toTagDto(row!);
}

/** Rename a tag; validates ownership and uniqueness excluding self (v1 api_tags.py:81). */
export async function renameTag(nid: number, tid: number, name: string): Promise<SourceTag> {
  const rawName = requireTagName(name);
  const existing = await client().get(
    db()
      .select()
      .from(sourceTags)
      .where(and(eq(sourceTags.id, tid), eq(sourceTags.notebookId, nid))),
  );
  if (!existing) throw new NotFoundError(`Tag ${tid} not found in notebook ${nid}`);
  const conflict = await findConflict(nid, rawName, tid);
  if (conflict) {
    throw new AppHttpError(ErrorCode.CONFLICT, 'Tag name already exists', {
      existingTagId: conflict.id,
    });
  }
  await client().run(db().update(sourceTags).set({ name: rawName }).where(eq(sourceTags.id, tid)));
  // c57: invalidate sources cache
  bumpSourcesEpoch(nid);
  const updated = await client().get(db().select().from(sourceTags).where(eq(sourceTags.id, tid)));
  return toTagDto(updated!);
}

/** Delete a tag and its bindings (ownership checked) (v1 api_tags.py:110). */
export async function deleteTag(nid: number, tid: number): Promise<void> {
  const existing = await client().get(
    db()
      .select()
      .from(sourceTags)
      .where(and(eq(sourceTags.id, tid), eq(sourceTags.notebookId, nid))),
  );
  if (!existing) throw new NotFoundError(`Tag ${tid} not found in notebook ${nid}`);
  await client().run(db().delete(sourceTags).where(eq(sourceTags.id, tid)));
  // c57: invalidate sources cache
  bumpSourcesEpoch(nid);
}

/** Assign sources to a tag; idempotent with per-item diagnostics. */
export async function assignSourcesToTag(nid: number, tid: number, body: TagBindingRequest) {
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
    const src = await client().get(
      db()
        .select({ id: sources.id })
        .from(sources)
        .where(and(eq(sources.id, sid), eq(sources.notebookId, nid))),
    );
    if (!src) {
      results.push({ sourceId: sid, ok: false, errorCode: 'SOURCE_NOT_FOUND' });
      continue;
    }
    const existing = await client().get(
      db()
        .select()
        .from(sourceTagMap)
        .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid))),
    );
    if (existing) {
      skipped++;
      results.push({ sourceId: sid, ok: true, message: 'already assigned' });
      continue;
    }
    await client().run(db().insert(sourceTagMap).values({ sourceId: sid, tagId: tid }));
    applied++;
    results.push({ sourceId: sid, ok: true });
  }
  // c57: invalidate sources cache (tag binding changed)
  if (applied > 0) bumpSourcesEpoch(nid);
  return { tagId: tid, sourceIds, applied, skipped, results };
}

/** Remove sources from a tag; reports unassigned as skipped with per-item diagnostics. */
export async function removeSourcesFromTag(nid: number, tid: number, body: TagBindingRequest) {
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
    const src = await client().get(
      db()
        .select({ id: sources.id })
        .from(sources)
        .where(and(eq(sources.id, sid), eq(sources.notebookId, nid))),
    );
    if (!src) {
      results.push({ sourceId: sid, ok: false, errorCode: 'SOURCE_NOT_FOUND' });
      continue;
    }
    const existing = await client().get(
      db()
        .select()
        .from(sourceTagMap)
        .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid))),
    );
    if (!existing) {
      skipped++;
      results.push({ sourceId: sid, ok: true, message: 'not assigned' });
      continue;
    }
    await client().run(
      db()
        .delete(sourceTagMap)
        .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid))),
    );
    removed++;
    results.push({ sourceId: sid, ok: true });
  }
  // c57: invalidate sources cache (tag unbinding changed)
  if (removed > 0) bumpSourcesEpoch(nid);
  return { tagId: tid, sourceIds, removed, skipped, results };
}
