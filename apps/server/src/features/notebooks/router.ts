import {
  Empty204Schema,
  NotebookCreateQuerySchema,
  NotebookCreateSchema,
  NotebookUpdateSchema,
  NotebookSchema,
  IdSchema,
  desc as i18nDesc,
} from '@crystalith/shared';
// Notebooks CRUD router — /v2/notebooks
//
// Mirrors v1 `features/notebooks/api.py` behavior but adapted to Elysia +
// Drizzle direct DB access (no async SQLAlchemy session). Each handler
// returns a serialized Notebook matching the shared Zod schema.
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { client, db } from '../../db/index.ts';
import { notebooks, sessions, sourceTags, sources, templates } from '../../db/schema.ts';
import { deleteSourceVectors } from '../../db/vectors.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { PathId } from '../../shared/ids.ts';

// ---------------------------------------------------------------------------
// OpenAPI doc registration (manual spec — @elysiajs/openapi auto-gen uses
// Zod ^3 compatible library; we run Zod v4, so the manual route provides
// richer descriptions via registerApiDoc → generateOpenApiDocument)
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks',
    method: 'get',
    summary: '列出全部笔记本',
    tags: ['notebooks'],
    responses: {
      200: {
        description: '笔记本列表',
        body: NotebookSchema.array(),
        example: [
          {
            id: 1,
            name: '我的研究笔记',
            createdAt: '2026-07-14T07:15:57.000Z',
            updatedAt: '2026-07-14T07:15:57.000Z',
          },
        ],
      },
    },
  },
  {
    path: '/v2/notebooks',
    method: 'post',
    summary: '创建笔记本；可带 templateId 预置会话与来源标签',
    tags: ['notebooks'],
    request: { body: NotebookCreateSchema },
    responses: {
      201: {
        description: '已创建的笔记本',
        body: NotebookSchema,
        example: {
          id: 1,
          name: '我的研究笔记',
          createdAt: '2026-07-14T07:15:57.000Z',
          updatedAt: '2026-07-14T07:15:57.000Z',
        },
      },
    },
  },
  {
    path: '/v2/notebooks/:nid',
    method: 'get',
    summary: '按 id 获取笔记本',
    tags: ['notebooks'],
    request: { params: { nid: IdSchema.describe(i18nDesc('notebook.id')) } },
    responses: {
      200: {
        description: '笔记本',
        body: NotebookSchema,
        example: {
          id: 1,
          name: '我的研究笔记',
          createdAt: '2026-07-14T07:15:57.000Z',
          updatedAt: '2026-07-14T07:15:57.000Z',
        },
      },
    },
  },
  {
    path: '/v2/notebooks/:nid',
    method: 'patch',
    summary: '更新笔记本名称',
    tags: ['notebooks'],
    request: {
      params: { nid: IdSchema.describe(i18nDesc('notebook.id')) },
      body: NotebookUpdateSchema,
    },
    responses: { 200: { description: '已更新的笔记本', body: NotebookSchema } },
  },
  {
    path: '/v2/notebooks/:nid',
    method: 'delete',
    summary: '删除笔记本及其下属会话、消息、来源等',
    tags: ['notebooks'],
    request: { params: { nid: IdSchema.describe(i18nDesc('notebook.id')) } },
    responses: { 204: { description: '已删除' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeNotebook(row: { id: number; name: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function notFound(id: number): never {
  throw new NotFoundError(`Notebook ${id} not found`);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const notebooksRouter = new Elysia({ prefix: '/v2' })
  // List all notebooks
  .get(
    '/notebooks',
    async () => {
      const rows = await client().all(
        db().select().from(notebooks).orderBy(desc(notebooks.updatedAt)),
      );
      return rows.map(serializeNotebook);
    },
    { response: NotebookSchema.array() },
  )

  // Create a notebook (c39 gap fix: templateId apply-on-create — v1 service.py:19-50)
  .post(
    '/notebooks',
    async ({ body, query, set }) => {
      const templateId = query.templateId ?? null;

      const row = (await client().get(
        db().insert(notebooks).values({ name: body.name }).returning(),
      ))!;

      // Apply template: create sessions + tags from config (v1 service.py:36-46)
      if (templateId) {
        const template = (await client().get(
          db().select().from(templates).where(eq(templates.id, templateId)),
        ))!;
        if (!template) {
          throw new NotFoundError(`Template ${templateId} not found`);
        }
        const config = (template.configJson ?? {}) as {
          sessionTitles?: string[];
          sourceTags?: string[];
        };
        const templateSessionTitles = config.sessionTitles ?? [];
        const templateSourceTags = config.sourceTags ?? [];
        for (const title of templateSessionTitles) {
          await client().run(db().insert(sessions).values({ notebookId: row.id, title }));
        }
        for (const tagName of templateSourceTags) {
          await client().run(db().insert(sourceTags).values({ notebookId: row.id, name: tagName }));
        }
      }

      set.status = 201;
      return serializeNotebook(row);
    },
    { query: NotebookCreateQuerySchema, body: NotebookCreateSchema, response: NotebookSchema },
  )

  // Get a single notebook
  .get(
    '/notebooks/:nid',
    async ({ params }) => {
      const id = params.nid;
      const row = (await client().get(db().select().from(notebooks).where(eq(notebooks.id, id))))!;
      if (!row) notFound(id);
      return serializeNotebook(row);
    },
    { params: z.object({ nid: PathId }), response: NotebookSchema },
  )

  // Update a notebook
  .patch(
    '/notebooks/:nid',
    async ({ params, body }) => {
      const id = params.nid;
      const existing = (await client().get(
        db().select().from(notebooks).where(eq(notebooks.id, id)),
      ))!;
      if (!existing) notFound(id);
      const updated = (await client().get(
        db().update(notebooks).set({ name: body.name }).where(eq(notebooks.id, id)).returning(),
      ))!;
      return serializeNotebook(updated);
    },
    { params: z.object({ nid: PathId }), body: NotebookUpdateSchema, response: NotebookSchema },
  )

  // Delete a notebook
  .delete(
    '/notebooks/:nid',
    async ({ params, set }) => {
      const id = params.nid;
      const existing = (await client().get(
        db().select().from(notebooks).where(eq(notebooks.id, id)),
      ))!;
      if (!existing) notFound(id);
      // vec_chunks has no FK — cascade only cleans relational rows, so source
      // vectors must be dropped explicitly or they leak forever.
      const notebookSources = await client().all(
        db().select({ id: sources.id }).from(sources).where(eq(sources.notebookId, id)),
      );
      for (const s of notebookSources) await deleteSourceVectors(db(), s.id);
      await client().run(db().delete(notebooks).where(eq(notebooks.id, id)));
      set.status = 204;
      return;
    },
    { params: z.object({ nid: PathId }), response: { 204: Empty204Schema } },
  );

// Register OpenAPI docs
registerApiDoc(apiDocs);
