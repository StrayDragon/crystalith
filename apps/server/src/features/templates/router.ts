import {
  Empty204Schema,
  TemplateArraySchema,
  TemplateCreateSchema,
  TemplateSchema,
} from '@crystalith/shared';
// Templates router — CRUD for generation templates.
//
// Templates store config_json (Nunjucks-compatible config) for reusable
// generation presets. Used by slides generation and other output workflows.
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { client, db } from '../../db/index.ts';
import { templates } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { PathId } from '../../shared/ids.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/templates',
    method: 'get',
    summary: '列出全部模板',
    tags: ['templates'],
    responses: { 200: { description: '模板列表', body: TemplateArraySchema } },
  },
  {
    path: '/v2/templates',
    method: 'post',
    summary: '创建模板',
    tags: ['templates'],
    responses: { 201: { description: '已创建的模板', body: TemplateSchema } },
  },
  {
    path: '/v2/templates/:id',
    method: 'get',
    summary: '按 id 获取模板',
    tags: ['templates'],
    responses: { 200: { description: '模板', body: TemplateSchema } },
  },
  {
    path: '/v2/templates/:id',
    method: 'patch',
    summary: '更新模板',
    tags: ['templates'],
    responses: { 200: { description: '已更新的模板', body: TemplateSchema } },
  },
  {
    path: '/v2/templates/:id',
    method: 'delete',
    summary: '删除模板',
    tags: ['templates'],
    responses: { 204: { description: '已删除' } },
  },
];

function serializeTemplate(row: typeof templates.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    configJson: row.configJson,
    isBuiltin: row.isBuiltin,
    createdAt: row.createdAt.toISOString(),
  };
}

export const templatesRouter = new Elysia({ prefix: '/v2' })
  .get(
    '/templates',
    async () => {
      const rows = await client().all(
        db().select().from(templates).orderBy(desc(templates.createdAt)),
      );
      return rows.map(serializeTemplate);
    },
    { response: TemplateArraySchema },
  )
  .post(
    '/templates',
    async ({ body, set }) => {
      const row = (await client().get(
        db()
          .insert(templates)
          .values({
            name: body.name,
            description: body.description ?? null,
            configJson: body.configJson,
          })
          .returning(),
      ))!;
      set.status = 201;
      return serializeTemplate(row);
    },
    { body: TemplateCreateSchema, response: TemplateSchema },
  )
  .get(
    '/templates/:id',
    async ({ params }) => {
      const id = params.id;
      const row = await client().get(db().select().from(templates).where(eq(templates.id, id)));
      if (!row) throw new NotFoundError(`Template ${id} not found`);
      return serializeTemplate(row);
    },
    { params: z.object({ id: PathId }), response: TemplateSchema },
  )
  .patch(
    '/templates/:id',
    async ({ params, body }) => {
      const id = params.id;
      const existing = await client().get(
        db().select().from(templates).where(eq(templates.id, id)),
      );
      if (!existing) throw new NotFoundError(`Template ${id} not found`);
      // c61: builtin templates cannot be modified (v1 service.py:110-111)
      if (existing.isBuiltin) {
        throw new AppHttpError(ErrorCode.CONFLICT, 'Built-in templates cannot be modified');
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description ?? null;
      if (body.configJson !== undefined) updateData.configJson = body.configJson;

      const updated = (await client().get(
        db().update(templates).set(updateData).where(eq(templates.id, id)).returning(),
      ))!;
      return serializeTemplate(updated);
    },
    {
      params: z.object({ id: PathId }),
      body: TemplateCreateSchema.partial(),
      response: TemplateSchema,
    },
  )
  .delete(
    '/templates/:id',
    async ({ params, set }) => {
      const id = params.id;
      const existing = await client().get(
        db().select().from(templates).where(eq(templates.id, id)),
      );
      if (!existing) throw new NotFoundError(`Template ${id} not found`);
      // c61: builtin templates cannot be deleted (v1 service.py:126-127)
      if (existing.isBuiltin) {
        throw new AppHttpError(ErrorCode.CONFLICT, 'Built-in templates cannot be deleted');
      }
      await client().run(db().delete(templates).where(eq(templates.id, id)));
      set.status = 204;
      return;
    },
    { params: z.object({ id: PathId }), response: { 204: Empty204Schema } },
  );

registerApiDoc(apiDocs);
