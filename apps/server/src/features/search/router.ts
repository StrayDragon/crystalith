// Global knowledge search router — POST /v2/search (c132 r484).
//
// Thin wire over rag/search-service.ts: hybrid retrieval across notebooks
// (or one), flat results + grouping facets, explicit degradation flag when
// only the keyword channel could serve the query (r488).
import { SearchRequestSchema, SearchResponseSchema } from '@crystalith/shared';
import { Elysia } from 'elysia';

import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { knowledgeSearch } from '../../rag/search-service.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/search',
    method: 'post',
    summary:
      '知识库全局搜索：语义+关键词混合召回（跨全部笔记本或指定笔记本），结果携带笔记本/来源类型分组与跳转引用；索引不可用时降级为关键词单通道并显式标注',
    tags: ['search'],
    responses: {
      200: { description: '搜索结果（扁平命中 + 分组摘要）', body: SearchResponseSchema },
    },
  },
];

export const searchRouter = new Elysia({ prefix: '/v2' }).post(
  '/search',
  async ({ body }) => {
    const result = await knowledgeSearch(body.query, body.scope ?? { kind: 'all' }, {
      topK: body.topK,
      minScore: body.minScore,
      originTypes: body.originTypes,
    });
    return {
      results: result.items,
      facets: result.facets,
      ...(result.degraded ? { degraded: result.degraded } : {}),
    };
  },
  {
    body: SearchRequestSchema,
    response: { 200: SearchResponseSchema },
  },
);

registerApiDoc(apiDocs);
