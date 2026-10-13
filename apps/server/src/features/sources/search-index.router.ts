// Search index ops router — /v2/notebooks/:nid/search-index (c131 r480/r481).
//
// POST .../rebuild starts an ASYNC rebuild job (202 + handle; 409 while one is
// already covering this notebook). GET .../ returns the honest index state
// (ready / rebuilding / dim_mismatch / interrupted) with progress and dims.
import { SearchIndexRebuildResponseSchema, SearchIndexStatusSchema } from '@crystalith/shared';
import { Elysia } from 'elysia';
import { z } from 'zod';

import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getIndexState, startIndexRebuild } from '../../rag/index-rebuild.ts';
import { PathId } from '../../shared/ids.ts';
import { requireNotebook } from '../../shared/notebook-scope.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/search-index/rebuild',
    method: 'post',
    summary: '异步重建该笔记本的嵌入索引；维度不一致时升级为整库重建（重建表并重嵌全部笔记本）',
    tags: ['sources'],
    responses: {
      202: { description: '重建任务已启动', body: SearchIndexRebuildResponseSchema },
      409: { description: '已有重建任务覆盖该笔记本' },
    },
  },
  {
    path: '/v2/notebooks/:nid/search-index',
    method: 'get',
    summary: '查询笔记本嵌入索引状态（就绪/重建中/维度不匹配/被中断，含进度与维度值）',
    tags: ['sources'],
    responses: { 200: { description: '索引状态', body: SearchIndexStatusSchema } },
  },
];

export const searchIndexRouter = new Elysia({ prefix: '/v2' })
  .post(
    '/notebooks/:nid/search-index/rebuild',
    async ({ params, set }) => {
      requireNotebook(params.nid);
      const result = await startIndexRebuild(params.nid);
      set.status = 202;
      return result;
    },
    {
      params: z.object({ nid: PathId }),
      response: { 202: SearchIndexRebuildResponseSchema },
    },
  )
  .get(
    '/notebooks/:nid/search-index',
    ({ params }) => {
      requireNotebook(params.nid);
      return getIndexState(params.nid);
    },
    {
      params: z.object({ nid: PathId }),
      response: { 200: SearchIndexStatusSchema },
    },
  );

registerApiDoc(apiDocs);
