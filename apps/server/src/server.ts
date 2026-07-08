import { desc } from 'drizzle-orm';
import { Elysia } from 'elysia';

import { generateAsyncApiDocument } from './asyncapi.ts';
import { db } from './db/index.ts';
import { notebooks } from './db/schema.ts';
import { generateOpenApiDocument, registerApiDoc, type OpenApiRoute } from './openapi.ts';
import { getModels, getModelDefaults } from './shared/config.ts';

// ---------------------------------------------------------------------------
// OpenAPI doc registration (static — not inside handlers)
// ---------------------------------------------------------------------------
// When c04 lands, features/*/router.ts will call registerApiDoc() from their
// own modules and mount via app.use(router).  The inline handlers below are
// temporary scaffold.
// ---------------------------------------------------------------------------

const { NotebookListSchema, ModelListSchema } = await import('@crystalith/shared');

const apiDocs: OpenApiRoute[] = [];
registerApiDoc(apiDocs);

function doc(r: OpenApiRoute): OpenApiRoute {
  apiDocs.push(r);
  return r;
}

// Pre-register OpenAPI descriptors for the scaffold routes below.
doc({
  path: '/v2/health',
  method: 'get',
  summary: 'Health check',
  tags: ['system'],
  responses: { 200: { description: 'Server health status' } },
});

doc({
  path: '/v2/notebooks',
  method: 'get',
  summary: 'List all notebooks',
  tags: ['notebooks'],
  responses: {
    200: { description: 'List of notebooks', body: NotebookListSchema },
  },
});

doc({
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
  // Health check
  .get('/health', () => ({ status: 'ok', version: '2.0.0-dev' }))

  // OpenAPI + AsyncAPI document endpoints
  .get('/openapi.json', () => generateOpenApiDocument())
  .get('/asyncapi.json', () => generateAsyncApiDocument())

  // API v2 prefix
  .group('/v2', (app) =>
    app
      .get('/', () => ({ message: 'Crystalith v2 API' }))

      // Health (under v2 prefix)
      .get('/health', () => ({ status: 'ok' }))

      // Notebooks — list (temp scaffold; c04 will move to features/notebooks/router.ts)
      .get('/notebooks', () => {
        const rows = db().select().from(notebooks).orderBy(desc(notebooks.updatedAt)).all();
        return { notebooks: rows.map(serializeNotebook) };
      })

      // Models (read-only from config)
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

  .listen({
    port: process.env.CL_SERVER_PORT ? parseInt(process.env.CL_SERVER_PORT) : 8032,
  });

console.log(
  `🦊 Crystalith v2 server running at http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;

// ---------------------------------------------------------------------------
// Serialization helpers (Drizzle row → API response)
// ---------------------------------------------------------------------------

function serializeNotebook(row: { id: number; name: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: row.id,
    name: row.name,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
