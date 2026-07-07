import { TemplateCreateSchema } from '@crystalith/shared';
// Templates router — CRUD for generation templates.
//
// Templates store config_json (Nunjucks-compatible config) for reusable
// generation presets. Used by slides generation and other output workflows.
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { templates } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/templates',
    method: 'get',
    summary: 'List all templates',
    tags: ['templates'],
    responses: { 200: { description: 'Template list' } },
  },
  {
    path: '/v2/templates',
    method: 'post',
    summary: 'Create a template',
    tags: ['templates'],
    responses: { 201: { description: 'Created template' } },
  },
  {
    path: '/v2/templates/:id',
    method: 'get',
    summary: 'Get a template',
    tags: ['templates'],
    responses: { 200: { description: 'Template details' } },
  },
  {
    path: '/v2/templates/:id',
    method: 'patch',
    summary: 'Update a template',
    tags: ['templates'],
    responses: { 200: { description: 'Updated template' } },
  },
  {
    path: '/v2/templates/:id',
    method: 'delete',
    summary: 'Delete a template',
    tags: ['templates'],
    responses: { 204: { description: 'Deleted' } },
  },
];

function serializeTemplate(row: typeof templates.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    config_json: row.configJson,
    is_builtin: row.isBuiltin,
    created_at: row.createdAt.toISOString(),
  };
}

export const templatesRouter = new Elysia({ prefix: '/v2' })
  .get('/templates', () => {
    const rows = db().select().from(templates).orderBy(desc(templates.createdAt)).all();
    return rows.map(serializeTemplate);
  })
  .post(
    '/templates',
    ({ body }) => {
      const row = db()
        .insert(templates)
        .values({
          name: body.name,
          description: body.description ?? null,
          configJson: body.config_json,
        })
        .returning()
        .get();
      return serializeTemplate(row);
    },
    { body: TemplateCreateSchema },
  )
  .get('/templates/:id', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(templates).where(eq(templates.id, id)).get();
    if (!row) throw new NotFoundError(`Template ${id} not found`);
    return serializeTemplate(row);
  })
  .patch(
    '/templates/:id',
    ({ params, body }) => {
      const id = Number(params.id);
      const existing = db().select().from(templates).where(eq(templates.id, id)).get();
      if (!existing) throw new NotFoundError(`Template ${id} not found`);

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description ?? null;
      if (body.config_json !== undefined) updateData.configJson = body.config_json;

      const updated = db()
        .update(templates)
        .set(updateData)
        .where(eq(templates.id, id))
        .returning()
        .get();
      return serializeTemplate(updated);
    },
    { body: TemplateCreateSchema.partial() },
  )
  .delete('/templates/:id', ({ params, set }) => {
    const id = Number(params.id);
    const existing = db().select().from(templates).where(eq(templates.id, id)).get();
    if (!existing) throw new NotFoundError(`Template ${id} not found`);
    db().delete(templates).where(eq(templates.id, id)).run();
    set.status = 204;
    return '';
  });

registerApiDoc(apiDocs);
