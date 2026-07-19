// RAG Strategies API router — /v2/strategies, /v2/notebooks/:id/strategies
//
// Exposes strategy listing + per-notebook configuration.
import {
  NotebookStrategiesResponseSchema,
  NotebookStrategiesSetRequestSchema,
  RagStrategyInfoSchema,
} from '@crystalith/shared';
import { Elysia } from 'elysia';

import { registerApiDoc, type OpenApiRoute } from '../openapi.ts';
import { EmbedStrategy } from '../rag/embed-strategy.ts';
import { HybridStrategy } from '../rag/hybrid-strategy.ts';
import { KeywordStrategy } from '../rag/keyword-strategy.ts';
import { PageIndexStrategy } from '../rag/page-index-strategy.ts';
import { ragRegistry } from '../rag/registry.ts';
import { requirePositiveIntId } from '../shared/ids.ts';

// Bootstrap: register default strategies
ragRegistry.register(new EmbedStrategy());
ragRegistry.register(new KeywordStrategy());
ragRegistry.register(new HybridStrategy());
ragRegistry.register(new PageIndexStrategy());

// ---------------------------------------------------------------------------
// OpenAPI doc registration
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/strategies',
    method: 'get',
    summary: 'List available RAG strategies',
    tags: ['rag'],
    responses: {
      200: { description: 'Available strategies', body: RagStrategyInfoSchema.array() },
    },
  },
  {
    path: '/v2/notebooks/:id/strategies',
    method: 'get',
    summary: 'Get enabled strategies for a notebook',
    tags: ['rag'],
    responses: {
      200: { description: 'Enabled strategy IDs', body: NotebookStrategiesResponseSchema },
    },
  },
  {
    path: '/v2/notebooks/:id/strategies',
    method: 'post',
    summary: 'Set strategies for a notebook',
    tags: ['rag'],
    responses: {
      200: { description: 'Updated strategy config', body: NotebookStrategiesResponseSchema },
    },
  },
];

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const strategiesRouter = new Elysia({ prefix: '/v2' })
  // List available strategies
  .get('/strategies', () => ragRegistry.listAll(), {
    response: RagStrategyInfoSchema.array(),
  })

  // Get strategies for a notebook
  .get(
    '/notebooks/:nid/strategies',
    ({ params }) => {
      const notebookId = requirePositiveIntId(params.nid, 'notebook id');
      return {
        notebookId: notebookId,
        strategies: ragRegistry.getForNotebook(notebookId),
      };
    },
    { response: NotebookStrategiesResponseSchema },
  )

  // Set strategies for a notebook
  .post(
    '/notebooks/:nid/strategies',
    ({ params, body }) => {
      const notebookId = requirePositiveIntId(params.nid, 'notebook id');
      ragRegistry.setForNotebook(notebookId, body.strategies);
      return {
        notebookId: notebookId,
        strategies: body.strategies,
      };
    },
    { body: NotebookStrategiesSetRequestSchema, response: NotebookStrategiesResponseSchema },
  );

registerApiDoc(apiDocs);
