## Approach

Elysia is a Bun-first TypeScript web framework with end-to-end type inference.
The v2 server follows Elysia's recommended architecture:

### Architecture

```
apps/server/src/
├── server.ts              # Entry: Elysia app instance + route registration
├── openapi.ts             # OpenAPI doc builder (@asteasolutions/zod-to-openapi)
├── asyncapi.ts            # AsyncAPI doc for streaming endpoints
├── features/              # Domain modules (one folder per feature)
│   ├── notebooks/
│   │   ├── router.ts      # .get()/.post()/.patch()/.delete() — thin, delegates to service
│   │   ├── service.ts     # Business logic
│   │   └── repo.ts        # Data access (Drizzle queries)
│   └── ...
├── ai/                    # AI SDK provider registry + tools
│   ├── provider-registry.ts  # Config-driven (whitelist + dynamic import)
│   ├── model-resolver.ts     # resolveModel(config) → LanguageModelV1
│   ├── generate.ts           # generateObject wrapper
│   ├── stream.ts             # streamText SSE relay
│   └── middleware.ts         # retry middleware
├── rag/                   # RAG strategies
├── db/                    # Drizzle instance + schema + migrations
├── config/                # Config loading (Nunjucks + YAML)
└── shared/                # Cross-cutting: epoch, token counter, concurrency
```

### Key Patterns

1. **Router-first**: Each feature is a standalone Elysia instance, mounted via `.use()`:

   ```ts
   // features/notebooks/router.ts
   import { Elysia } from 'elysia';
   import { z } from 'zod';
   import { NotebookSchema, CreateNotebookSchema } from '@crystalith/shared';

   export const notebooksRouter = new Elysia({ prefix: '/v2/notebooks' })
     .get('/', () => notebookService.list(), {
       response: z.array(NotebookSchema),
     })
     .post(
       '/',
       ({ body, set }) => {
         set.status = 201;
         return notebookService.create(body);
       },
       {
         body: CreateNotebookSchema,
         response: NotebookSchema,
       },
     );
   ```

   Then in server.ts:

   ```ts
   const app = new Elysia().use(notebooksRouter).use(sessionsRouter);
   // ...
   ```

2. **Zod SSOT (单源真相)**: 所有 schema 定义在 `packages/shared/src/schemas/`，server 和 frontend 共同 import。
   Elysia 1.4+ 通过 `StandardSchemaV1` 协议原生支持 Zod v4 —— `body: z.object({...})` 直接可用，类型推导正常。
   **不使用** Elysia 的 `t` (TypeBox) 体系，**不使用** `@elysiajs/swagger` (依赖 TypeBox JSON Schema 元数据)。

3. **OpenAPI 生成**: 通过 `@asteasolutions/zod-to-openapi` 从 Zod schema 独立生成 `/openapi.json`：

   ```ts
   // apps/server/src/openapi.ts
   import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
   import { NotebookSchema, CreateNotebookSchema } from '@crystalith/shared';

   const registry = new OpenAPIRegistry();
   registry.registerPath({
     method: 'post',
     path: '/v2/notebooks',
     request: { body: { schema: CreateNotebookSchema } },
     responses: { 201: { description: 'Created', schema: NotebookSchema } },
   });
   export const openApiDoc = new OpenApiGeneratorV3(registry.definitions).generateDocument({
     openapi: '3.0.3',
     info: { title: 'Crystalith API', version: '2.0.0' },
   });
   ```

   自动化: server 启动时自动生成，serve 到 `GET /openapi.json`。外部用户用 `openapi-generator` 生成 Python/Go/Rust SDK。

4. **AsyncAPI (流式端点)**: SSE 流式端点的文档通过手写 AsyncAPI 3.0 YAML，serve 到 `GET /asyncapi.json`。
   流式端点少（QA stream、Research progress），维护成本极低。

5. **eden RPC export**: Always export the app type for frontend:

   ```ts
   export type App = typeof app;
   ```

6. **Error handling**: Use Elysia's `onError` hook for centralized error handling
   ```ts
   app.onError(({ code, error }) => {
     return { error_code: code, message: error.message };
   });
   ```

## Dependencies

- elysia@^1.4.29 — HTTP framework
- @elysiajs/eden@^1.4.9 — Type-safe RPC client (internal frontend)
- @elysiajs/jwt@^1 (optional, Phase 8 server mode)
- @elysiajs/cors@^1 (optional)
- @elysiajs/static@^1 — Serve frontend dist/ (Phase 8)
- @asteasolutions/zod-to-openapi@^8 — OpenAPI doc generation (replaces @elysiajs/swagger)
- zod@^4 — Schema validation SSOT (shared with frontend)

### Explicitly NOT used

- `@elysiajs/swagger` — Depends on TypeBox JSON Schema metadata; incompatible with Zod SSOT approach
