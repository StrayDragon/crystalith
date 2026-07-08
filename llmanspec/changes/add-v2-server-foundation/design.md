## Approach

Elysia is a Bun-first TypeScript web framework with end-to-end type inference.
The v2 server follows Elysia's recommended architecture:

### Architecture

```
server/src/
├── server.ts              # Entry: Elysia app instance + route registration
├── features/              # Domain modules (one folder per feature)
│   ├── notebooks/
│   │   ├── router.ts      # .get()/.post()/.patch()/.delete() — thin, delegates to service
│   │   ├── service.ts     # Business logic
│   │   ├── repo.ts        # Data access (Drizzle queries)
│   │   └── schemas.ts     # Zod schemas (request body, response)
│   └── ...
├── shared/                # Cross-cutting infrastructure
│   ├── db/                # Drizzle instance + schema + migrations
│   ├── ai/                # AI SDK provider registry + tools
│   ├── config/            # Config loading (Nunjucks + YAML)
│   └── utils/             # Shared utilities
├── middlewares/            # Global Elysia middlewares (auth, logging, error)
└── lib/                    # Third-party integrations (unpdf, cheerio, etc.)
```

### Key Patterns

1. **Router-first**: Each feature exports a function `(app: Elysia) => Elysia` that mounts its routes
   ```ts
   // features/notebooks/router.ts
   import { Elysia, t } from 'elysia';
   import { NotebookSchema } from './schemas';
   
   export const notebooksRouter = new Elysia({ prefix: '/notebooks' })
     .get('/', () => notebookService.list())
     .post('/', ({ body }) => notebookService.create(body), {
       body: t.Object({ name: t.String() }),
       response: NotebookSchema,
     });
   ```
   
   Then in server.ts:
   ```ts
   const app = new Elysia()
     .use(notebooksRouter)
     .use(sessionsRouter)
     // ...
   ```

2. **Zod-first validation**: Elysia's `t` is Zod-compatible. Prefer Zod for complex schemas:
   ```ts
   import { z } from 'zod';
   export const NotebookSchema = z.object({
     id: z.number(),
     name: z.string(),
     created_at: z.date(),
   });
   ```

3. **eden RPC export**: Always export the app type for frontend:
   ```ts
   export type App = typeof app;
   ```

4. **Error handling**: Use Elysia's `onError` hook for centralized error handling
   ```ts
   app.onError(({ code, error }) => {
     return { error_code: code, message: error.message };
   });
   ```

## Dependencies

- elysia@^1.4.29 — HTTP framework
- @elysiajs/eden@^1.4.9 — Type-safe RPC client
- @elysiajs/jwt@^1 (optional, Phase 4 server mode)
- @elysiajs/cors@^1 (optional)
