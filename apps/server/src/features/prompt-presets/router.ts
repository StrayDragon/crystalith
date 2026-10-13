import { Empty204Schema, PromptPresetCreateSchema, PromptPresetSchema } from '@crystalith/shared';
// Prompt presets router — CRUD for chat prompt presets (/prompt:xxx pattern).
//
// Prompt presets are injected into the QA system prompt when the user
// types /prompt:<trigger> in their message. Each preset has a trigger
// (short name), description, and system_prompt.
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { client, db } from '../../db/index.ts';
import { promptPresets } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { PathId } from '../../shared/ids.ts';
import { PRESET_CAPABLE_GENERATION_TYPES } from '../generation-types/registry.ts';
import { listPresets } from '../qa/presets.ts';

/** c61: builtin preset trigger set for conflict detection. */
const BUILTIN_TRIGGERS = new Set(listPresets().map((p) => p.name.toLowerCase()));

/**
 * c61: check trigger uniqueness (no duplicate custom) + no builtin conflict.
 * Returns an error message string if conflict, or null if OK.
 * `excludeId` allows PATCH to keep its own trigger (exclude self from dup check).
 */
async function checkTriggerConflict(trigger: string, excludeId?: number): Promise<string | null> {
  const normalized = trigger.trim().toLowerCase();
  if (BUILTIN_TRIGGERS.has(normalized)) {
    return `Trigger '${trigger}' conflicts with a built-in preset`;
  }
  const dupQuery = db().select().from(promptPresets);
  // no-op filter; we check below
  const dup = excludeId
    ? await client().all(dupQuery.where(eq(promptPresets.id, excludeId)))
    : await client().all(dupQuery);
  // Check all customs (excluding self if PATCH)
  const customs = await client().all(db().select().from(promptPresets));
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
    summary: '列出提示词预设（/prompt:trigger）',
    tags: ['prompt-presets'],
    responses: { 200: { description: '预设列表' } },
  },
  {
    path: '/v2/prompt-presets',
    method: 'post',
    summary: '创建提示词预设',
    tags: ['prompt-presets'],
    responses: { 201: { description: '已创建的预设' } },
  },
  {
    path: '/v2/prompt-presets/:id',
    method: 'patch',
    summary: '更新提示词预设',
    tags: ['prompt-presets'],
    responses: { 200: { description: '已更新的预设' } },
  },
  {
    path: '/v2/prompt-presets/:id',
    method: 'delete',
    summary: '删除提示词预设',
    tags: ['prompt-presets'],
    responses: { 204: { description: '已删除' } },
  },
];

function serializePreset(row: typeof promptPresets.$inferSelect) {
  return {
    id: row.id,
    trigger: row.trigger,
    description: row.description,
    systemPrompt: row.systemPrompt,
    enabled: row.enabled,
    generationTypeId: row.generationTypeId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** r188: presets bind to a generation type; only preset-capable types accept creation. */
function assertPresetCapableType(generationTypeId: string | undefined): void {
  if (
    generationTypeId !== undefined &&
    !PRESET_CAPABLE_GENERATION_TYPES.includes(generationTypeId as 'qa')
  ) {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      `Generation type '${generationTypeId}' does not support prompt presets`,
      { supported: [...PRESET_CAPABLE_GENERATION_TYPES] },
    );
  }
}

export const promptPresetsRouter = new Elysia({ prefix: '/v2' })
  .get(
    '/prompt-presets',
    async () => {
      const rows = await client().all(
        db().select().from(promptPresets).orderBy(desc(promptPresets.createdAt)),
      );
      return rows.map(serializePreset);
    },
    { response: PromptPresetSchema.array() },
  )
  .post(
    '/prompt-presets',
    async ({ body, set }) => {
      // c61: trigger uniqueness + builtin conflict (v1 service.py:74-85)
      const conflict = await checkTriggerConflict(body.trigger);
      if (conflict) {
        throw new AppHttpError(ErrorCode.CONFLICT, conflict);
      }
      assertPresetCapableType(body.generationTypeId);
      const row = (await client().get(
        db()
          .insert(promptPresets)
          .values({
            trigger: body.trigger,
            description: body.description ?? null,
            systemPrompt: body.systemPrompt,
            enabled: body.enabled ?? true,
            generationTypeId: body.generationTypeId ?? 'qa',
          })
          .returning(),
      ))!;
      set.status = 201;
      return serializePreset(row);
    },
    { body: PromptPresetCreateSchema, response: PromptPresetSchema },
  )
  .patch(
    '/prompt-presets/:id',
    async ({ params, body }) => {
      const id = params.id;
      const existing = (await client().get(
        db().select().from(promptPresets).where(eq(promptPresets.id, id)),
      ))!;
      if (!existing) throw new NotFoundError(`Preset ${id} not found`);

      // c61: if changing trigger, check uniqueness + builtin conflict (exclude self)
      if (body.trigger !== undefined) {
        const conflict = await checkTriggerConflict(body.trigger, id);
        if (conflict) {
          throw new AppHttpError(ErrorCode.CONFLICT, conflict);
        }
      }

      assertPresetCapableType(body.generationTypeId);
      const updateData: Record<string, unknown> = {};
      if (body.trigger !== undefined) updateData.trigger = body.trigger;
      if (body.generationTypeId !== undefined) updateData.generationTypeId = body.generationTypeId;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
      if (body.enabled !== undefined) updateData.enabled = body.enabled;

      const updated = (await client().get(
        db().update(promptPresets).set(updateData).where(eq(promptPresets.id, id)).returning(),
      ))!;
      return serializePreset(updated);
    },
    {
      params: z.object({ id: PathId }),
      body: PromptPresetCreateSchema.partial(),
      response: PromptPresetSchema,
    },
  )
  .delete(
    '/prompt-presets/:id',
    async ({ params, set }) => {
      const id = params.id;
      const existing = (await client().get(
        db().select().from(promptPresets).where(eq(promptPresets.id, id)),
      ))!;
      if (!existing) throw new NotFoundError(`Preset ${id} not found`);
      await client().run(db().delete(promptPresets).where(eq(promptPresets.id, id)));
      set.status = 204;
      return;
    },
    { params: z.object({ id: PathId }), response: { 204: Empty204Schema } },
  );

registerApiDoc(apiDocs);
