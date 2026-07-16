import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';

import { generateAsyncApiDocument } from './asyncapi.ts';
// Feature routers — each exports an Elysia instance + registers OpenAPI docs
// 20 routers total, matching v1's 18 routers
import { analysisRouter } from './features/analysis/router.ts';
import { citationsRouter } from './features/citations/router.ts';
import { commandsRouter } from './features/commands/router.ts';
import { evalRouter } from './features/eval/router.ts';
import { messagesRouter } from './features/messages/router.ts';
import { modelsRouter } from './features/models/router.ts';
import { notebooksRouter } from './features/notebooks/router.ts';
import { outputsRouter } from './features/outputs/router.ts';
import { promptPresetsRouter } from './features/prompt-presets/router.ts';
import { qaRouter } from './features/qa/router.ts';
import { refineRouter } from './features/refine/router.ts';
import { researchRouter, cleanupExpiredLocks } from './features/research/router.ts';
import { sessionsRouter } from './features/sessions/router.ts';
import { sourceConnectorsRouter } from './features/source-connectors/router.ts';
import { sourcesRouter } from './features/sources/router.ts';
import { sourceExtrasRouter } from './features/sources/source-extras.router.ts';
import { studioRouter } from './features/studio/router.ts';
import { tasksRouter } from './features/tasks/router.ts';
import { createStageLimiters, runTask } from './features/tasks/worker.ts';
import { templatesRouter } from './features/templates/router.ts';
import { workspaceRouter } from './features/workspace/router.ts';
import { generateOpenApiDocument, registerApiDoc, type OpenApiRoute } from './openapi.ts';
import { strategiesRouter } from './rag/router.ts';
import { getOptionalServices } from './shared/config.ts';
import { TaskQueue } from './shared/queue.ts';

// ---------------------------------------------------------------------------
// Task queue (c19)
// ---------------------------------------------------------------------------

const taskQueue = new TaskQueue();
const stageLimiters = createStageLimiters();

// Crash recovery: mark stalled running tasks as failed on startup.
taskQueue.recoverStaleTasks();
// Research: release/cancel sessions whose locks expired while the process was down.
cleanupExpiredLocks();

// Start worker dispatch loop.
taskQueue.startWorker(async (taskId, signal) => {
  const { db } = await import('./db/index.ts');
  const { tasks: row } = await import('./db/schema.ts');
  const { eq } = await import('drizzle-orm');
  const task = db().select().from(row).where(eq(row.id, taskId)).get();
  if (!task) throw new Error(`Task ${taskId} not found for dispatch`);
  // The `type` lives on the tasks column; merge it into the payload so the
  // dispatch switch in runTask can read payload.type (TaskPayload expects it).
  const payload = {
    type: task.type,
    notebookId: task.notebookId ?? undefined,
    ...(task.payload as Record<string, unknown>),
  } as unknown as import('./features/tasks/worker.ts').TaskPayload;
  return runTask(taskId, payload, signal, stageLimiters);
});

// ---------------------------------------------------------------------------
// Scaffold OpenAPI docs
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
// App — 20 feature routers + 1 rag router
//
// `createApp()` builds the Elysia instance without listening; the production
// entry calls `.listen()` below, while tests import `createApp` to run
// requests in-process via `app.handle()` without binding a port.
// ---------------------------------------------------------------------------

export function createApp() {
  return new Elysia()
    .use(
      openapi({
        provider: 'scalar',
        path: '/openapi',
        specPath: '/openapi.json',
        documentation: {
          info: {
            title: 'Crystalith v2 API',
            version: '2.0.0-dev',
            description: 'RAG-powered knowledge notebook — v2 API',
          },
        },
      }),
    )
    .get('/health', () => ({ status: 'ok', version: '2.0.0-dev' }))
    .get('/health/dependencies', async () => {
      const opt = getOptionalServices();
      const now = new Date().toISOString();

      // Probe SearXNG if enabled — short timeout, fail fast.
      let searxngStatus: string;
      let searxngHealthy: boolean | null;
      if (opt.searxng.enabled && opt.searxng.endpoint) {
        try {
          const res = await fetch(opt.searxng.endpoint, {
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
        generated_at: now,
        last_probe: now,
        core: {
          backend: { service: 'api', healthy: true },
          frontend: {
            service: 'web',
            healthy: null,
            note: 'frontend health is validated through reverse-proxy route /health',
          },
        },
        optional: {
          storage_chroma: {
            service: 'Chroma (Vector Store)',
            enabled: opt.chroma.enabled,
            endpoint: opt.chroma.enabled ? opt.chroma.endpoint : null,
            status: opt.chroma.enabled ? 'unknown' : 'disabled',
            healthy: null,
          },
          cache_redis: {
            service: 'Redis (Cache)',
            enabled: false,
            endpoint: null,
            status: 'disabled',
            healthy: null,
          },
          search_searxng: {
            service: 'SearXNG (Search)',
            enabled: opt.searxng.enabled,
            endpoint: opt.searxng.enabled ? opt.searxng.endpoint : null,
            status: searxngStatus,
            healthy: searxngHealthy,
          },
        },
      };
    })
    .get('/openapi.json', () => generateOpenApiDocument())
    .get('/asyncapi.json', () => generateAsyncApiDocument())

    .group('/v2', (app) =>
      app
        .get('/', () => ({ message: 'Crystalith v2 API' }))
        .get('/health', () => ({ status: 'ok' })),
    )

    .use(notebooksRouter)
    .use(sessionsRouter)
    .use(messagesRouter)
    .use(sourcesRouter)
    .use(sourceExtrasRouter)
    .use(qaRouter)
    .use(citationsRouter)
    .use(researchRouter)
    .use(outputsRouter)
    .use(modelsRouter)
    .use(analysisRouter)
    .use(studioRouter)
    .use(refineRouter(taskQueue))
    .use(templatesRouter)
    .use(promptPresetsRouter)
    .use(sourceConnectorsRouter)
    .use(tasksRouter(taskQueue))
    .use(commandsRouter)
    .use(workspaceRouter)
    .use(evalRouter)
    .use(strategiesRouter);
}

// Only listen when run as the entry point (not when imported by tests).
if (import.meta.main) {
  // Bind loopback by default (parity with v1 `_DEFAULT_LISTEN_HOST = "127.0.0.1"`).
  // v2 has no auth yet (c13 scope), so loopback binding is the primary network
  // exposure guard. Override with CL_SERVER_HOST=0.0.0.0 for docker/LAN once
  // auth is in place.
  const app = createApp()
    .decorate('taskQueue', taskQueue)
    .listen({
      hostname: process.env.CL_SERVER_HOST ?? '127.0.0.1',
      port: process.env.CL_SERVER_PORT ? parseInt(process.env.CL_SERVER_PORT) : 8032,
    });
  console.log(
    `🦊 Crystalith v2 server running at http://${app.server?.hostname}:${app.server?.port}`,
  );
}

export type App = ReturnType<typeof createApp>;
