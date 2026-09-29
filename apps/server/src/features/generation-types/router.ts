import { GenerationTypesListResponseSchema } from '@crystalith/shared';
// Generation types router — the typed-generation-framework list endpoint.
//
// Frontend entry rendering queries the available generation types here (r466);
// the payload is the per-type contract descriptor (r323 minimal contract).
import { Elysia } from 'elysia';

import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { listGenerationTypes } from './registry.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/generation-types',
    method: 'get',
    summary: '列出可用生成类型及其合约（输入要求/输出类型面/默认输出类型/完成语义/控制项）',
    tags: ['generation-types'],
    responses: { 200: { description: '生成类型列表' } },
  },
];

export const generationTypesRouter = new Elysia({ prefix: '/v2' }).get(
  '/generation-types',
  () => ({ types: listGenerationTypes() }),
  { response: GenerationTypesListResponseSchema },
);

registerApiDoc(apiDocs);
