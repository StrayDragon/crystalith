import { ModelListSchema } from '@crystalith/shared';
import { Elysia } from 'elysia';

import { generateAsyncApiDocument } from './asyncapi.ts';
import { citationsRouter } from './features/citations/router.ts';
import { messagesRouter } from './features/messages/router.ts';
// Feature routers — each exports an Elysia instance + registers OpenAPI docs
import { notebooksRouter } from './features/notebooks/router.ts';
import { outputsRouter } from './features/outputs/router.ts';
import { qaRouter } from './features/qa/router.ts';
import { researchRouter } from './features/research/router.ts';
import { sessionsRouter } from './features/sessions/router.ts';
import { sourcesRouter } from './features/sources/router.ts';
import { generateOpenApiDocument, registerApiDoc, type OpenApiRoute } from './openapi.ts';
import { strategiesRouter } from './rag/router.ts';
import { getModels, getModelDefaults } from './shared/config.ts';

// ---------------------------------------------------------------------------
// Scaffold OpenAPI docs (health, models — temp until c10)
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [];
registerApiDoc(apiDocs);

apiDocs.push({
  path: '/v2/health',
  method: 'get',
  summary: 'Health check',
  tags: ['system'],
  responses: { 200: { description: 'Server health status' } },
});

apiDocs.push({
  path: '/v2/models',
  method: 'get',
  summary: 'List available models',
  tags: ['models'],
  responses: {
    200: { description: 'Available model configurations', body: ModelListSchema },
  },
});

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Elysia()
  // Health check (uncategorized)
  .get('/health', () => ({ status: 'ok', version: '2.0.0-dev' }))

  // OpenAPI + AsyncAPI document endpoints
  .get('/openapi.json', () => generateOpenApiDocument())
  .get('/asyncapi.json', () => generateAsyncApiDocument())

  // API v2 prefix group
  .group('/v2', (app) =>
    app
      .get('/', () => ({ message: 'Crystalith v2 API' }))

      // Health (under v2)
      .get('/health', () => ({ status: 'ok' }))

      // Models (read-only from config — temp, c10 will own this)
      .get('/models', () => {
        const models = getModels();
        const defaults = getModelDefaults();
        return {
          defaults,
          models: models.available.map((m) => ({
            id: m.id,
            provider: m.provider,
            model: m.model,
            display_name: m.display_name,
            description: m.description,
            roles: m.roles,
            capabilities: m.capabilities,
            is_default_chat: defaults.chat === m.id,
            is_default_embedding: defaults.embedding === m.id,
          })),
        };
      }),
  )

  // Mount feature routers
  .use(notebooksRouter)
  .use(sessionsRouter)
  .use(messagesRouter)
  .use(sourcesRouter)
  .use(qaRouter)
  .use(citationsRouter)
  .use(researchRouter)
  .use(outputsRouter)
  .use(strategiesRouter)

  .listen({
    port: process.env.CL_SERVER_PORT ? parseInt(process.env.CL_SERVER_PORT) : 8032,
  });

console.log(
  `🦊 Crystalith v2 server running at http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
