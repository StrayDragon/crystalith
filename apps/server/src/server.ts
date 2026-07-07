import { Elysia } from 'elysia';

import { generateAsyncApiDocument } from './asyncapi.ts';
// Feature routers — each exports an Elysia instance + registers OpenAPI docs
import { analysisRouter } from './features/analysis/router.ts';
import { citationsRouter } from './features/citations/router.ts';
import { evalRouter } from './features/eval/router.ts';
import { messagesRouter } from './features/messages/router.ts';
import { modelsRouter } from './features/models/router.ts';
import { notebooksRouter } from './features/notebooks/router.ts';
import { outputsRouter } from './features/outputs/router.ts';
import { promptPresetsRouter } from './features/prompt-presets/router.ts';
import { qaRouter } from './features/qa/router.ts';
import { refineRouter } from './features/refine/router.ts';
import { researchRouter } from './features/research/router.ts';
import { sessionsRouter } from './features/sessions/router.ts';
import { sourcesRouter } from './features/sources/router.ts';
import { studioRouter } from './features/studio/router.ts';
import { templatesRouter } from './features/templates/router.ts';
import { generateOpenApiDocument, registerApiDoc, type OpenApiRoute } from './openapi.ts';
import { strategiesRouter } from './rag/router.ts';

// ---------------------------------------------------------------------------
// Scaffold OpenAPI docs (health — models is now in modelsRouter)
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

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Elysia()
  // Health check
  .get('/health', () => ({ status: 'ok', version: '2.0.0-dev' }))

  // OpenAPI + AsyncAPI document endpoints
  .get('/openapi.json', () => generateOpenApiDocument())
  .get('/asyncapi.json', () => generateAsyncApiDocument())

  // API v2 prefix group
  .group('/v2', (app) =>
    app.get('/', () => ({ message: 'Crystalith v2 API' })).get('/health', () => ({ status: 'ok' })),
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
  .use(modelsRouter)
  .use(analysisRouter)
  .use(studioRouter)
  .use(refineRouter)
  .use(templatesRouter)
  .use(promptPresetsRouter)
  .use(evalRouter)
  .use(strategiesRouter)

  .listen({
    port: process.env.CL_SERVER_PORT ? parseInt(process.env.CL_SERVER_PORT) : 8032,
  });

console.log(
  `🦊 Crystalith v2 server running at http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
