import {
  ApiRootSchema,
  HealthDependenciesSchema,
  HealthResponseSchema,
  type HealthDependencies,
} from '@crystalith/shared';
import { openapi } from '@elysiajs/openapi';
import { Elysia, NotFoundError } from 'elysia';

import { generateAsyncApiDocument } from './asyncapi.ts';
// Feature routers — each exports an Elysia instance + registers OpenAPI docs
// 16 routers total (removed: citations, eval, refine, tasks, strategies HTTP)
import { commandsRouter } from './features/commands/router.ts';
import { messagesRouter } from './features/messages/router.ts';
import { modelsRouter } from './features/models/router.ts';
import { notebooksRouter } from './features/notebooks/router.ts';
import { outputsRouter } from './features/outputs/router.ts';
import { promptPresetsRouter } from './features/prompt-presets/router.ts';
import { qaRouter } from './features/qa/router.ts';
import { researchRouter } from './features/research/router.ts';
import { sessionsRouter } from './features/sessions/router.ts';
import { sourceConnectorsRouter } from './features/source-connectors/router.ts';
import { sourcesRouter } from './features/sources/router.ts';
import { sourceExtrasRouter } from './features/sources/source-extras.router.ts';
import { studioRouter } from './features/studio/router.ts';
import { templatesRouter } from './features/templates/router.ts';
import { workspaceRouter } from './features/workspace/router.ts';
import { generateOpenApiDocument, registerApiDoc } from './openapi.ts';
import { getOptionalServices } from './shared/config.ts';
import { ErrorCode, sendError, AppHttpError } from './shared/errors.ts';
import { outboundFetch } from './shared/net/outbound-fetch.ts';

// ---------------------------------------------------------------------------
// Scaffold OpenAPI docs
// ---------------------------------------------------------------------------

registerApiDoc([
  {
    path: '/v2/health',
    method: 'get',
    summary: '服务健康检查',
    tags: ['system'],
    responses: { 200: { description: '健康状态' } },
  },
]);

// ---------------------------------------------------------------------------
// App — 16 feature routers
//
// `createApp()` builds the Elysia instance without listening; the production
// entry calls `.listen()` below, while tests import `createApp` to run
// requests in-process via `app.handle()` without binding a port.
// ---------------------------------------------------------------------------

export function createApp() {
  return new Elysia()
    .onError(({ error, set, code }) => {
      if (error instanceof AppHttpError) {
        return sendError(set, error.code, error.message, error.details, error.retryAfter);
      }
      // Normalize Elysia NotFoundError / NOT_FOUND into ErrorEnvelope (c65).
      if (code === 'NOT_FOUND' || error instanceof NotFoundError) {
        const message =
          error instanceof Error && error.message ? error.message : 'Resource not found';
        return sendError(set, ErrorCode.NOT_FOUND, message);
      }
      // Validation failures → structured envelope instead of plain text.
      if (code === 'VALIDATION') {
        const message =
          error instanceof Error && error.message ? error.message : 'Request validation failed';
        return sendError(set, ErrorCode.SCHEMA_VALIDATION_FAILED, message);
      }
    })
    .use(
      openapi({
        provider: 'scalar',
        path: '/openapi',
        specPath: '/openapi.json',
        scalar: {
          showSidebar: true,
          hideModels: true,
          // Use path as endpoint heading (summary is now the path via registerApiDoc)
          defaultOpenAllTags: false,
          customCss: `:root { --scalar-radius: 6px; }`,
        },
        documentation: {
          info: {
            title: 'Crystalith v2 API',
            version: '2.0.0-dev',
            description: 'RAG-powered knowledge notebook — v2 API',
          },
        },
      }),
    )
    .get('/health', () => ({ status: 'ok', version: '2.0.0-dev' }), {
      response: HealthResponseSchema,
    })
    .get(
      '/health/dependencies',
      async (): Promise<HealthDependencies> => {
        const opt = getOptionalServices();
        const now = new Date().toISOString();

        // Probe SearXNG via same host as searchWeb (getSearxngHost SSOT).
        let searxngStatus: string;
        let searxngHealthy: boolean | null;
        if (opt.searxng.enabled && opt.searxng.endpoint) {
          try {
            const res = await outboundFetch(opt.searxng.endpoint, {
              method: 'GET',
              signal: AbortSignal.timeout((opt.searxng.timeout_s ?? 3) * 1000),
            });
            searxngStatus = res.ok ? 'healthy' : 'degraded';
            searxngHealthy = res.ok;
          } catch {
            searxngStatus = 'degraded';
            searxngHealthy = false;
          }
        } else {
          searxngStatus = 'disabled';
          searxngHealthy = null;
        }

        return {
          status: 'ok',
          generatedAt: now,
          lastProbe: now,
          core: {
            backend: { service: 'api', healthy: true },
            frontend: {
              service: 'web',
              healthy: null,
              note: 'frontend health is validated through reverse-proxy route /health',
            },
          },
          optional: {
            cacheRedis: {
              service: 'Redis (Cache)',
              enabled: false,
              endpoint: null,
              status: 'disabled',
              healthy: null,
            },
            searchSearxng: {
              service: 'SearXNG (Search)',
              enabled: opt.searxng.enabled,
              endpoint: opt.searxng.enabled ? (opt.searxng.endpoint ?? null) : null,
              status: searxngStatus,
              healthy: searxngHealthy,
            },
          },
        };
      },
      { response: HealthDependenciesSchema },
    )
    .get('/openapi.json', () => generateOpenApiDocument())
    .get('/asyncapi.json', () => generateAsyncApiDocument())

    .group('/v2', (app) =>
      app
        .get('/', () => ({ message: 'Crystalith v2 API' }), { response: ApiRootSchema })
        .get('/health', () => ({ status: 'ok' }), { response: HealthResponseSchema }),
    )

    .use(notebooksRouter)
    .use(sessionsRouter)
    .use(messagesRouter)
    .use(sourcesRouter)
    .use(sourceExtrasRouter)
    .use(qaRouter)
    .use(researchRouter)
    .use(outputsRouter)
    .use(modelsRouter)
    .use(studioRouter)
    .use(templatesRouter)
    .use(promptPresetsRouter)
    .use(sourceConnectorsRouter)
    .use(commandsRouter)
    .use(workspaceRouter);
}

// Only listen when run as the entry point (not when imported by tests).
if (import.meta.main) {
  // Bind loopback by default (parity with v1 `_DEFAULT_LISTEN_HOST = "127.0.0.1"`).
  // v2 has no auth yet (c13 scope), so loopback binding is the primary network
  // exposure guard. Override with CL_SERVER_HOST=0.0.0.0 for docker/LAN once
  // auth is in place.
  const app = createApp().listen({
    hostname: process.env.CL_SERVER_HOST ?? '127.0.0.1',
    port: process.env.CL_SERVER_PORT ? parseInt(process.env.CL_SERVER_PORT) : 8032,
    // Bun default idleTimeout is 10s and closes quiet in-flight responses
    // (incl. SSE waiting on LLM TTFB). Cap at Bun's max; SSE routes also call
    // server.timeout(req, 0) for indefinite streams.
    idleTimeout: 255,
  });
  console.log(
    `🦊 Crystalith v2 server running at http://${app.server?.hostname}:${app.server?.port}`,
  );
}

export type App = ReturnType<typeof createApp>;
