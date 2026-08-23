import {
  Empty204Schema,
  PaginatedSchema,
  PaginationParamsSchema,
  SessionConvertToOutputRequestSchema,
  SessionConvertToOutputResponseSchema,
  SessionConvertToSourceRequestSchema,
  SessionConvertToSourceResponseSchema,
  SessionCreateSchema,
  SessionSchema,
  SessionUpdateSchema,
} from '@crystalith/shared';
// Sessions CRUD router — /v2/notebooks/:nid/sessions
//
// Mirrors v1 `features/sessions/api.py` on Elysia + Drizzle.
import { count, desc, eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { z } from 'zod';

import { db } from '../../db/index.ts';
import { sessions } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { NidParamsSchema, PathId } from '../../shared/ids.ts';
import { requireOwnedRow } from '../../shared/notebook-scope.ts';
import { convertSessionToOutput, convertSessionToSource } from './convert.ts';

// ---------------------------------------------------------------------------
// OpenAPI doc registration
// ---------------------------------------------------------------------------

const SessionsPageSchema = PaginatedSchema(SessionSchema);

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/sessions',
    method: 'get',
    summary: '分页列出笔记本下的会话',
    tags: ['sessions'],
    request: {
      query: PaginationParamsSchema,
    },
    responses: { 200: { description: '会话列表', body: SessionsPageSchema } },
  },
  {
    path: '/v2/notebooks/:nid/sessions',
    method: 'post',
    summary: '在笔记本下创建会话',
    tags: ['sessions'],
    request: { body: SessionCreateSchema },
    responses: { 201: { description: '已创建的会话', body: SessionSchema } },
  },
  {
    path: '/v2/notebooks/:nid/sessions/:sid',
    method: 'get',
    summary: '按 id 获取单个会话',
    tags: ['sessions'],
    responses: { 200: { description: '会话', body: SessionSchema } },
  },
  {
    path: '/v2/notebooks/:nid/sessions/:sid',
    method: 'patch',
    summary: '更新会话标题或状态',
    tags: ['sessions'],
    request: { body: SessionUpdateSchema },
    responses: { 200: { description: '已更新的会话', body: SessionSchema } },
  },
  {
    path: '/v2/notebooks/:nid/sessions/:sid',
    method: 'delete',
    summary: '删除会话及其消息',
    tags: ['sessions'],
    responses: { 204: { description: '已删除' } },
  },
  {
    path: '/v2/notebooks/:nid/sessions/:sid/convert-to-source',
    method: 'post',
    summary: '将会话消息转为来源并分块向量化',
    tags: ['sessions'],
    responses: {
      201: {
        description: '由会话生成的来源',
        body: SessionConvertToSourceResponseSchema,
      },
    },
  },
  {
    path: '/v2/notebooks/:nid/sessions/:sid/convert-to-output',
    method: 'post',
    summary: '将会话消息整理为产出（段落/要点/结构化）',
    tags: ['sessions'],
    responses: { 201: { description: '由会话生成的产出' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeSession(row: {
  id: number;
  notebookId: number;
  title: string | null;
  sharedState: Record<string, unknown>;
  sharedStateRevision: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    notebookId: row.notebookId,
    title: row.title,
    sharedState: row.sharedState,
    sharedStateRevision: row.sharedStateRevision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const sessionsRouter = new Elysia({ prefix: '/v2' })
  // List sessions for a notebook
  .get(
    '/notebooks/:nid/sessions',
    ({ params, query }) => {
      const nid = params.nid;
      const { offset, limit } = query;
      const total =
        db().select({ n: count() }).from(sessions).where(eq(sessions.notebookId, nid)).get()?.n ??
        0;
      const rows = db()
        .select()
        .from(sessions)
        .where(eq(sessions.notebookId, nid))
        .orderBy(desc(sessions.updatedAt))
        .limit(limit)
        .offset(offset)
        .all();
      return {
        items: rows.map(serializeSession),
        total,
        offset,
        limit,
      };
    },
    { params: NidParamsSchema, query: PaginationParamsSchema, response: SessionsPageSchema },
  )

  // Get a single session (c39: v1 api.py:200-209)
  .get(
    '/notebooks/:nid/sessions/:sid',
    ({ params }) => {
      const nid = params.nid;
      const sid = params.sid;
      return serializeSession(requireOwnedRow(sessions, sid, nid, 'Session'));
    },
    { params: z.object({ nid: PathId, sid: PathId }), response: SessionSchema },
  )

  // Create a session
  .post(
    '/notebooks/:nid/sessions',
    ({ params, body, set }) => {
      const nid = params.nid;
      const row = db()
        .insert(sessions)
        .values({
          notebookId: nid,
          title: body.title ?? null,
        })
        .returning()
        .get();
      set.status = 201;
      return serializeSession(row);
    },
    { params: NidParamsSchema, body: SessionCreateSchema, response: SessionSchema },
  )

  // Update a session (c39: notebook ownership check)
  .patch(
    '/notebooks/:nid/sessions/:sid',
    ({ params, body }) => {
      const nid = params.nid;
      const sid = params.sid;
      const existing = requireOwnedRow(sessions, sid, nid, 'Session');

      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;

      // Optimistic-concurrency check: only apply if revision matches
      if (body.sharedStateRevision !== undefined) {
        if (body.sharedStateRevision !== existing.sharedStateRevision) {
          throw new AppHttpError(
            ErrorCode.CONFLICT,
            'Session state has been modified by another client',
          );
        }
        if (body.sharedState !== undefined) {
          updateData.sharedState = body.sharedState;
          updateData.sharedStateRevision = existing.sharedStateRevision + 1;
        }
      }

      const updated = db()
        .update(sessions)
        .set(updateData)
        .where(eq(sessions.id, sid))
        .returning()
        .get();
      return serializeSession(updated);
    },
    {
      params: z.object({ nid: PathId, sid: PathId }),
      body: SessionUpdateSchema,
      response: SessionSchema,
    },
  )

  // Delete a session (c39: notebook ownership check)
  .delete(
    '/notebooks/:nid/sessions/:sid',
    ({ params, set }) => {
      const nid = params.nid;
      const sid = params.sid;
      requireOwnedRow(sessions, sid, nid, 'Session');
      db().delete(sessions).where(eq(sessions.id, sid)).run();
      set.status = 204;
      return;
    },
    { params: z.object({ nid: PathId, sid: PathId }), response: { 204: Empty204Schema } },
  )

  // Convert session to source (c34: chunk + embed + vector — v1 behavior; c39: ownership + 201)
  .post(
    '/notebooks/:nid/sessions/:sid/convert-to-source',
    async ({ params, body, set }) => {
      const nid = params.nid;
      const sid = params.sid;
      const result = await convertSessionToSource(nid, sid, body);
      set.status = 201;
      return result;
    },
    {
      params: z.object({ nid: PathId, sid: PathId }),
      body: SessionConvertToSourceRequestSchema,
      response: SessionConvertToSourceResponseSchema,
    },
  )

  // Convert session to output (c34: v1 parity; c39: ownership + 201 + chunk_ids)
  .post(
    '/notebooks/:nid/sessions/:sid/convert-to-output',
    ({ params, body, set }) => {
      const nid = params.nid;
      const sid = params.sid;
      const result = convertSessionToOutput(nid, sid, body);
      set.status = 201;
      return result;
    },
    {
      params: z.object({ nid: PathId, sid: PathId }),
      body: SessionConvertToOutputRequestSchema,
      response: SessionConvertToOutputResponseSchema,
    },
  );

registerApiDoc(apiDocs);
