/**
 * Deep Research HTTP surface.
 *
 * FE Desk/xyflow is under apps/web workspace research — this router is backend-only.
 */
import {
  ResearchConfirmBodySchema,
  ResearchConvertBodySchema,
  ResearchConvertToNoteResponseSchema,
  ResearchConvertToSourceResponseSchema,
  ResearchCreateNestedRequestSchema,
  ResearchForkBodySchema,
  ResearchListQuerySchema,
  ResearchNodeChatBodySchema,
  ResearchNodePatchBodySchema,
  ResearchProgressListSchema,
  ResearchProgressQuerySchema,
  ResearchReportPutBodySchema,
  ResearchReportViewSchema,
  ResearchRevisionCreateBodySchema,
  ResearchRevisionSchema,
  ResearchRevisionsListSchema,
  ResearchRunSchema,
  ResearchRunsPageSchema,
} from '@crystalith/shared';
import { Elysia } from 'elysia';
import { z } from 'zod';

import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import { resolveNestedNotebookId } from '../../shared/notebook-scope.ts';
import {
  cancelRun,
  confirmRun,
  convertToNote,
  convertToSource,
  createNodeChatSseResponse,
  createResearchSseResponse,
  createRevision,
  createRun,
  deleteWorkingReport,
  forkNode,
  getReportView,
  getRevision,
  getRun,
  listProgress,
  listRevisions,
  listRuns,
  patchNode,
  pruneNode,
  putCanonicalReport,
  putWorkingReport,
  restoreRevision,
} from './service.ts';

/** OpenAPI-only query docs (runtime validation uses ResearchListQuerySchema). */
const ResearchListStatusQueryDocSchema = z.string().optional().openapi({
  description: '按状态过滤，逗号分隔（如 running,queued）；亦接受重复 status query',
  example: 'running,awaiting_confirm',
});

registerApiDoc([
  {
    path: '/v2/notebooks/:nid/research',
    method: 'post',
    summary: '创建深度研究 ResearchRun',
    tags: ['research'],
    request: { body: ResearchCreateNestedRequestSchema },
    responses: { 201: { description: '已创建的 ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research',
    method: 'get',
    summary: '分页列出笔记本下的 ResearchRun（摘要，不含图）',
    tags: ['research'],
    request: {
      query: {
        offset: ResearchListQuerySchema.shape.offset,
        limit: ResearchListQuerySchema.shape.limit,
        status: ResearchListStatusQueryDocSchema,
      },
    },
    responses: { 200: { description: 'ResearchRun 摘要列表', body: ResearchRunsPageSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid',
    method: 'get',
    summary: '按 id 获取 ResearchRun（含图与状态）',
    tags: ['research'],
    responses: { 200: { description: 'ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/stream',
    method: 'get',
    summary: 'ResearchRun 进度 SSE',
    tags: ['research'],
    responses: { 200: { description: 'SSE 流' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/confirm',
    method: 'post',
    summary: '确认预算/扩支等硬停点',
    tags: ['research'],
    request: { body: ResearchConfirmBodySchema },
    responses: { 200: { description: '已更新的 ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/cancel',
    method: 'post',
    summary: '取消 ResearchRun',
    tags: ['research'],
    responses: {
      200: { description: '已取消/取消中的 ResearchRun', body: ResearchRunSchema },
    },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/nodes/:nodeId/prune',
    method: 'post',
    summary: '剪除研究图子树',
    tags: ['research'],
    responses: { 200: { description: '已更新的 ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/nodes/:nodeId/fork',
    method: 'post',
    summary: '从节点分叉或请求扩支',
    tags: ['research'],
    request: { body: ResearchForkBodySchema },
    responses: { 200: { description: '已更新的 ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/nodes/:nodeId',
    method: 'patch',
    summary: '更新节点标题/查询/结论状态',
    tags: ['research'],
    request: { body: ResearchNodePatchBodySchema },
    responses: { 200: { description: '已更新的 ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/nodes/:nodeId/chat',
    method: 'post',
    summary: '节点范围对话（仅提案，不自动改图）',
    tags: ['research'],
    request: { body: ResearchNodeChatBodySchema },
    responses: { 200: { description: 'SSE 流' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/progress',
    method: 'get',
    summary: '进度账本（afterSeq 补洞）',
    tags: ['research'],
    request: { query: ResearchProgressQuerySchema.shape },
    responses: { 200: { description: '进度事件', body: ResearchProgressListSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/revisions',
    method: 'get',
    summary: '列出版本快照',
    tags: ['research'],
    responses: { 200: { description: '版本列表', body: ResearchRevisionsListSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/revisions',
    method: 'post',
    summary: '创建用户版本快照',
    tags: ['research'],
    request: { body: ResearchRevisionCreateBodySchema },
    responses: { 201: { description: '已创建的版本', body: ResearchRevisionSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/revisions/:revId',
    method: 'get',
    summary: '按 id 获取版本快照',
    tags: ['research'],
    responses: { 200: { description: '版本', body: ResearchRevisionSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/revisions/:revId/restore',
    method: 'post',
    summary: '恢复版本（仅终态 run）',
    tags: ['research'],
    responses: { 200: { description: '已更新的 ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/report',
    method: 'get',
    summary: '获取 canonical 与 working 报告视图',
    tags: ['research'],
    responses: { 200: { description: '报告视图', body: ResearchReportViewSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/report',
    method: 'put',
    summary: '写入 canonical 报告',
    tags: ['research'],
    request: { body: ResearchReportPutBodySchema },
    responses: { 200: { description: '报告视图', body: ResearchReportViewSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/report/working',
    method: 'put',
    summary: '写入/创建 working 报告（仅终态）',
    tags: ['research'],
    request: { body: ResearchReportPutBodySchema },
    responses: { 200: { description: '报告视图', body: ResearchReportViewSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/report/working',
    method: 'delete',
    summary: '丢弃 working 报告',
    tags: ['research'],
    responses: { 200: { description: '报告视图', body: ResearchReportViewSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/convert-to-note',
    method: 'post',
    summary: '将研究产物转为段落笔记',
    tags: ['research'],
    request: { body: ResearchConvertBodySchema },
    responses: {
      201: { description: '段落产出', body: ResearchConvertToNoteResponseSchema },
    },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/convert-to-source',
    method: 'post',
    summary: '将研究产物摄取为来源并向量化',
    tags: ['research'],
    request: { body: ResearchConvertBodySchema },
    responses: {
      201: {
        description: '已创建的来源',
        body: ResearchConvertToSourceResponseSchema,
      },
    },
  },
] satisfies OpenApiRoute[]);

export const researchRouter = new Elysia({ prefix: '/v2' })
  .post(
    '/notebooks/:nid/research',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const notebookId = resolveNestedNotebookId(nid, body.notebookId);
      const run = createRun(notebookId, body);
      set.status = 201;
      return run;
    },
    { body: ResearchCreateNestedRequestSchema, response: ResearchRunSchema },
  )
  .get(
    '/notebooks/:nid/research',
    ({ params, query }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      return listRuns(nid, query.offset ?? 0, query.limit ?? 20, query.status);
    },
    { query: ResearchListQuerySchema, response: ResearchRunsPageSchema },
  )
  .get(
    '/notebooks/:nid/research/:rid',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return getRun(nid, rid);
    },
    { response: ResearchRunSchema },
  )
  .get('/notebooks/:nid/research/:rid/stream', ({ params, request, server }) => {
    const nid = requirePositiveIntId(params.nid, 'notebook id');
    const rid = requirePositiveIntId(params.rid, 'research run id');
    // Bun closes quiet SSE after idleTimeout (default 10s); keep run streams alive.
    try {
      server?.timeout?.(request, 0);
    } catch {
      // app.handle / non-Bun — no-op
    }
    return createResearchSseResponse(nid, rid);
  })
  .post(
    '/notebooks/:nid/research/:rid/confirm',
    async ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return confirmRun(nid, rid, body);
    },
    { body: ResearchConfirmBodySchema, response: ResearchRunSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/cancel',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return cancelRun(nid, rid);
    },
    { response: ResearchRunSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/nodes/:nodeId/prune',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return pruneNode(nid, rid, params.nodeId);
    },
    { response: ResearchRunSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/nodes/:nodeId/fork',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return forkNode(nid, rid, params.nodeId, body);
    },
    { body: ResearchForkBodySchema, response: ResearchRunSchema },
  )
  .patch(
    '/notebooks/:nid/research/:rid/nodes/:nodeId',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return patchNode(nid, rid, params.nodeId, body);
    },
    { body: ResearchNodePatchBodySchema, response: ResearchRunSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/nodes/:nodeId/chat',
    ({ params, body, request, server }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      // Chat TTFB often exceeds Bun's default idleTimeout; disable per-request.
      try {
        server?.timeout?.(request, 0);
      } catch {
        // app.handle / non-Bun — no-op
      }
      return createNodeChatSseResponse(nid, rid, params.nodeId, body, request.signal);
    },
    { body: ResearchNodeChatBodySchema },
  )
  .get(
    '/notebooks/:nid/research/:rid/progress',
    ({ params, query }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return listProgress(nid, rid, query.afterSeq ?? 0, query.limit ?? 100);
    },
    { query: ResearchProgressQuerySchema, response: ResearchProgressListSchema },
  )
  .get(
    '/notebooks/:nid/research/:rid/revisions',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return listRevisions(nid, rid);
    },
    { response: ResearchRevisionsListSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/revisions',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      const rev = createRevision(nid, rid, body);
      set.status = 201;
      return rev;
    },
    { body: ResearchRevisionCreateBodySchema, response: ResearchRevisionSchema },
  )
  .get(
    '/notebooks/:nid/research/:rid/revisions/:revId',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return getRevision(nid, rid, params.revId);
    },
    { response: ResearchRevisionSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/revisions/:revId/restore',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return restoreRevision(nid, rid, params.revId);
    },
    { response: ResearchRunSchema },
  )
  .get(
    '/notebooks/:nid/research/:rid/report',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return getReportView(nid, rid);
    },
    { response: ResearchReportViewSchema },
  )
  .put(
    '/notebooks/:nid/research/:rid/report',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return putCanonicalReport(nid, rid, body.report);
    },
    { body: ResearchReportPutBodySchema, response: ResearchReportViewSchema },
  )
  .put(
    '/notebooks/:nid/research/:rid/report/working',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return putWorkingReport(nid, rid, body.report);
    },
    { body: ResearchReportPutBodySchema, response: ResearchReportViewSchema },
  )
  .delete(
    '/notebooks/:nid/research/:rid/report/working',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return deleteWorkingReport(nid, rid);
    },
    { response: ResearchReportViewSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/convert-to-note',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      const result = convertToNote(nid, rid, body);
      set.status = 201;
      return result;
    },
    { body: ResearchConvertBodySchema, response: ResearchConvertToNoteResponseSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/convert-to-source',
    async ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      const result = await convertToSource(nid, rid, body);
      set.status = 201;
      return result;
    },
    { body: ResearchConvertBodySchema, response: ResearchConvertToSourceResponseSchema },
  );
