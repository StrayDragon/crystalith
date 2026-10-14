// Global knowledge-base search wire (c132 r484) — the top-bar search box.
// Hybrid (semantic + keyword RRF) over source chunks and indexed outputs;
// scope is all-notebooks or one notebook. Flat results + grouping facets;
// each item carries jump context (source chunk / output reference).
import { z } from 'zod';

import { desc } from './i18n.js';

export const SearchScopeSchema = z
  .discriminatedUnion('kind', [
    z
      .object({ kind: z.literal('all') })
      .describe(desc('globalSearch.scope.all', '全局范围：跨全部笔记本')),
    z
      .object({
        kind: z.literal('notebook'),
        notebookId: z
          .number()
          .int()
          .positive()
          .describe(desc('globalSearch.scope.notebookId', '限定搜索的笔记本 id')),
      })
      .describe(desc('globalSearch.scope.notebook', '笔记本范围')),
  ])
  .describe(desc('globalSearch.scope', '搜索范围：全局或指定笔记本；缺省全局'));

export const SearchOriginTypeSchema = z
  .enum(['source', 'output'])
  .describe(desc('globalSearch.originType', '命中对象来源类型：source 资料块 / output 产出'));

export const SearchRequestSchema = z
  .object({
    query: z.string().min(1).describe(desc('globalSearch.query', '搜索词（支持中文短词）')),
    scope: SearchScopeSchema.optional().describe(desc('globalSearch.request.scope', '搜索范围')),
    topK: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe(desc('globalSearch.topK', '返回条数请求值；服务端按 search.kb.max_top_k 钳制')),
    minScore: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(desc('globalSearch.minScore', '融合分数下限（0–1），缺省不过滤')),
    originTypes: z
      .array(SearchOriginTypeSchema)
      .optional()
      .describe(desc('globalSearch.request.originTypes', '限定来源类型；缺省全部')),
  })
  .openapi({ description: desc('globalSearch.request', '知识库搜索请求（顶栏搜索框）') });

export const SearchItemSchema = z
  .object({
    chunkId: z.number().int().describe(desc('globalSearch.item.chunkId', '命中块 id（跳转引用）')),
    text: z.string().describe(desc('globalSearch.item.text', '块全文（展示截断由前端处理）')),
    score: z
      .number()
      .min(0)
      .max(1)
      .describe(desc('globalSearch.item.score', '融合相关性（0–1，越高越相关）')),
    originType: SearchOriginTypeSchema,
    originId: z
      .number()
      .int()
      .nullable()
      .describe(
        desc(
          'globalSearch.item.originId',
          '来源对象 id：source 时即 source id；output 时为产出 id（跳转引用）',
        ),
      ),
    sourceId: z
      .number()
      .int()
      .describe(desc('globalSearch.item.sourceId', '承载该块的 sources 行 id')),
    sourceTitle: z.string().describe(desc('globalSearch.item.sourceTitle', '来源文件名/产出标题')),
    notebookId: z.number().int().describe(desc('globalSearch.item.notebookId', '所属笔记本 id')),
    notebookTitle: z
      .string()
      .describe(desc('globalSearch.item.notebookTitle', '所属笔记本名称（分组上下文）')),
    chunkIndex: z.number().int().describe(desc('globalSearch.item.chunkIndex', '块序号')),
    modality: z.string().describe(desc('globalSearch.item.modality', '模态（当前恒为 text）')),
  })
  .openapi({ description: desc('globalSearch.item', '单条搜索命中（携带分组与跳转上下文）') });

export const SearchNotebookFacetSchema = z
  .object({
    notebookId: z.number().int().describe(desc('globalSearch.facets.notebookId', '笔记本 id')),
    title: z.string().describe(desc('globalSearch.facets.title', '笔记本名称')),
    count: z.number().int().describe(desc('globalSearch.facets.count', '该笔记本命中数')),
  })
  .openapi({ description: desc('globalSearch.facets.notebook', '按笔记本分组计数') });

export const SearchOriginFacetSchema = z
  .object({
    type: SearchOriginTypeSchema,
    count: z.number().int().describe(desc('globalSearch.facets.originCount', '该来源类型命中数')),
  })
  .openapi({ description: desc('globalSearch.facets.originType', '按来源类型分组计数') });

export const SearchDegradedSchema = z
  .enum(['index_rebuilding', 'dim_mismatch', 'embed_unavailable'])
  .describe(
    desc(
      'globalSearch.degraded',
      '降级原因：语义通道不可用（索引重建中/维度不匹配/嵌入服务不可用），结果仅来自关键词通道',
    ),
  );

export const SearchResponseSchema = z
  .object({
    results: z.array(SearchItemSchema).describe(desc('globalSearch.response.results', '命中列表')),
    facets: z
      .object({
        notebooks: z
          .array(SearchNotebookFacetSchema)
          .describe(desc('globalSearch.facets.notebooks', '笔记本分组')),
        originTypes: z
          .array(SearchOriginFacetSchema)
          .describe(desc('globalSearch.facets.originTypes', '来源类型分组')),
      })
      .describe(desc('globalSearch.facets', '分组摘要（客户端据此渲染组头）')),
    degraded: SearchDegradedSchema.optional(),
  })
  .openapi({ description: desc('globalSearch.response', '知识库搜索结果') });

export type SearchScope = z.infer<typeof SearchScopeSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchItem = z.infer<typeof SearchItemSchema>;
export type SearchDegraded = z.infer<typeof SearchDegradedSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
