// RAG Strategies API router — /v2/strategies, /v2/notebooks/:id/strategies
//
// Exposes strategy listing + per-notebook configuration.
import { Elysia } from 'elysia';

import { registerApiDoc, type OpenApiRoute } from '../openapi.ts';
import { EmbedStrategy } from '../rag/embed-strategy.ts';
import { HybridStrategy } from '../rag/hybrid-strategy.ts';
import { KeywordStrategy } from '../rag/keyword-strategy.ts';
import { PageIndexStrategy } from '../rag/page-index-strategy.ts';
import { ragRegistry } from '../rag/registry.ts';

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
    responses: { 200: { description: 'Available strategies' } },
  },
  {
    path: '/v2/notebooks/:id/strategies',
    method: 'get',
    summary: 'Get enabled strategies for a notebook',
    tags: ['rag'],
    responses: { 200: { description: 'Enabled strategy IDs' } },
  },
  {
    path: '/v2/notebooks/:id/strategies',
    method: 'post',
    summary: 'Set strategies for a notebook',
    tags: ['rag'],
    responses: { 200: { description: 'Updated strategy config' } },
  },
];

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const strategiesRouter = new Elysia({ prefix: '/v2' })
  // List available strategies
  .get('/strategies', () => ragRegistry.listAll())

  // Get strategies for a notebook
  .get('/notebooks/:nid/strategies', ({ params }) => {
    const notebookId = Number(params.nid);
    return {
      notebookId: notebookId,
      strategies: ragRegistry.getForNotebook(notebookId),
    };
  })

  // Set strategies for a notebook
  .post('/notebooks/:nid/strategies', ({ params, body }) => {
    const notebookId = Number(params.nid);
    const strategyIds = (body as { strategies: string[] }).strategies;
    ragRegistry.setForNotebook(notebookId, strategyIds);
    return {
      notebookId: notebookId,
      strategies: strategyIds,
    };
  });

registerApiDoc(apiDocs);
