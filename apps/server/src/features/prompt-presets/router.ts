import { PromptPresetCreateSchema, PromptPresetSchema } from '@crystalith/shared';
// Prompt presets router — CRUD for chat prompt presets (/prompt:xxx pattern).
//
// Prompt presets are injected into the QA system prompt when the user
// types /prompt:<trigger> in their message. Each preset has a trigger
// (short name), description, and system_prompt.
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { promptPresets } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import { listPresets } from '../qa/presets.ts';

/** c61: builtin preset trigger set for conflict detection. */
const BUILTIN_TRIGGERS = new Set(listPresets().map((p) => p.name.toLowerCase()));

/**
 * c61: check trigger uniqueness (no duplicate custom) + no builtin conflict.
 * Returns an error message string if conflict, or null if OK.
 * `excludeId` allows PATCH to keep its own trigger (exclude self from dup check).
 */
function checkTriggerConflict(trigger: string, excludeId?: number): string | null {
  const normalized = trigger.trim().toLowerCase();
  if (BUILTIN_TRIGGERS.has(normalized)) {
    return `Trigger '${trigger}' conflicts with a built-in preset`;
  }
  const dupQuery = db().select().from(promptPresets);
  // no-op filter; we check below
  const dup = excludeId ? dupQuery.where(eq(promptPresets.id, excludeId)).all() : dupQuery.all();
  // Check all customs (excluding self if PATCH)
  const customs = db().select().from(promptPresets).all();
  const conflict = customs.find(
    (c) => c.trigger.trim().toLowerCase() === normalized && c.id !== excludeId,
  );
  if (conflict) {
    return `Trigger '${trigger}' already exists`;
  }
  // suppress unused
  void dup;
  return null;
}

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/prompt-presets',
    method: 'get',
    summary: 'List all prompt presets',
    tags: ['prompt-presets'],
    responses: { 200: { description: 'Preset list' } },
  },
  {
    path: '/v2/prompt-presets',
    method: 'post',
    summary: 'Create a prompt preset',
    tags: ['prompt-presets'],
    responses: { 201: { description: 'Created preset' } },
  },
  {
    path: '/v2/prompt-presets/:id',
    method: 'patch',
    summary: 'Update a prompt preset',
    tags: ['prompt-presets'],
    responses: { 200: { description: 'Updated preset' } },
  },
  {
    path: '/v2/prompt-presets/:id',
    method: 'delete',
    summary: 'Delete a prompt preset',
    tags: ['prompt-presets'],
    responses: { 204: { description: 'Deleted' } },
  },
];

function serializePreset(row: typeof promptPresets.$inferSelect) {
  return {
    id: row.id,
    trigger: row.trigger,
    description: row.description,
    systemPrompt: row.systemPrompt,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const promptPresetsRouter = new Elysia({ prefix: '/v2' })
  .get(
    '/prompt-presets',
    () => {
      const rows = db().select().from(promptPresets).orderBy(desc(promptPresets.createdAt)).all();
      return rows.map(serializePreset);
    },
    { response: PromptPresetSchema.array() },
  )
  .post(
    '/prompt-presets',
    ({ body, set }) => {
      // c61: trigger uniqueness + builtin conflict (v1 service.py:74-85)
      const conflict = checkTriggerConflict(body.trigger);
      if (conflict) {
        throw new AppHttpError(ErrorCode.CONFLICT, conflict);
      }
      const row = db()
        .insert(promptPresets)
        .values({
          trigger: body.trigger,
          description: body.description ?? null,
          systemPrompt: body.systemPrompt,
          enabled: body.enabled ?? true,
        })
        .returning()
        .get();
      set.status = 201;
      return serializePreset(row);
    },
    { body: PromptPresetCreateSchema, response: PromptPresetSchema },
  )
  .patch(
    '/prompt-presets/:id',
    ({ params, body }) => {
      const id = requirePositiveIntId(params.id, 'preset id');
      const existing = db().select().from(promptPresets).where(eq(promptPresets.id, id)).get();
      if (!existing) throw new NotFoundError(`Preset ${id} not found`);

      // c61: if changing trigger, check uniqueness + builtin conflict (exclude self)
      if (body.trigger !== undefined) {
        const conflict = checkTriggerConflict(body.trigger, id);
        if (conflict) {
          throw new AppHttpError(ErrorCode.CONFLICT, conflict);
        }
      }

      const updateData: Record<string, unknown> = {};
      if (body.trigger !== undefined) updateData.trigger = body.trigger;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
      if (body.enabled !== undefined) updateData.enabled = body.enabled;

      const updated = db()
        .update(promptPresets)
        .set(updateData)
        .where(eq(promptPresets.id, id))
        .returning()
        .get();
      return serializePreset(updated);
    },
    { body: PromptPresetCreateSchema.partial(), response: PromptPresetSchema },
  )
  .delete('/prompt-presets/:id', ({ params, set }) => {
    const id = requirePositiveIntId(params.id, 'preset id');
    const existing = db().select().from(promptPresets).where(eq(promptPresets.id, id)).get();
    if (!existing) throw new NotFoundError(`Preset ${id} not found`);
    db().delete(promptPresets).where(eq(promptPresets.id, id)).run();
    set.status = 204;
    return '';
  });

registerApiDoc(apiDocs);
