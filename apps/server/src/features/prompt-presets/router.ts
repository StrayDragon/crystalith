import { PromptPresetCreateSchema } from '@crystalith/shared';
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
    system_prompt: row.systemPrompt,
    enabled: row.enabled,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export const promptPresetsRouter = new Elysia({ prefix: '/v2' })
  .get('/prompt-presets', () => {
    const rows = db().select().from(promptPresets).orderBy(desc(promptPresets.createdAt)).all();
    return rows.map(serializePreset);
  })
  .post(
    '/prompt-presets',
    ({ body }) => {
      const row = db()
        .insert(promptPresets)
        .values({
          trigger: body.trigger,
          description: body.description ?? null,
          systemPrompt: body.system_prompt,
          enabled: body.enabled ?? true,
        })
        .returning()
        .get();
      return serializePreset(row);
    },
    { body: PromptPresetCreateSchema },
  )
  .patch(
    '/prompt-presets/:id',
    ({ params, body }) => {
      const id = Number(params.id);
      const existing = db().select().from(promptPresets).where(eq(promptPresets.id, id)).get();
      if (!existing) throw new NotFoundError(`Preset ${id} not found`);

      const updateData: Record<string, unknown> = {};
      if (body.trigger !== undefined) updateData.trigger = body.trigger;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.system_prompt !== undefined) updateData.systemPrompt = body.system_prompt;
      if (body.enabled !== undefined) updateData.enabled = body.enabled;

      const updated = db()
        .update(promptPresets)
        .set(updateData)
        .where(eq(promptPresets.id, id))
        .returning()
        .get();
      return serializePreset(updated);
    },
    { body: PromptPresetCreateSchema.partial() },
  )
  .delete('/prompt-presets/:id', ({ params, set }) => {
    const id = Number(params.id);
    const existing = db().select().from(promptPresets).where(eq(promptPresets.id, id)).get();
    if (!existing) throw new NotFoundError(`Preset ${id} not found`);
    db().delete(promptPresets).where(eq(promptPresets.id, id)).run();
    set.status = 204;
    return '';
  });

registerApiDoc(apiDocs);
