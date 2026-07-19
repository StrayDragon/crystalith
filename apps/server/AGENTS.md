# apps/server — Bun + Elysia API

Crystalith v2 HTTP server: Elysia + Drizzle (bun:sqlite) + Vercel AI SDK + sqlite-vec.

## Layout

```
src/
├── server.ts              # createApp() + listen; export type App for eden
├── openapi.ts / asyncapi.ts
├── ai/                    # provider registry, generate, stream, middleware, tools
├── db/                    # Drizzle schema, vectors, migrate
├── rag/                   # chunker, embedder, search, cache, strategy registry
├── features/              # domain routers (notebooks, qa, research, sources, …)
└── shared/                # config, queue, semaphore, net/SSRF, extraction, storage
```

Types/schemas: import from `@crystalith/shared` — do not redefine Zod models here.
Config yaml/env: Zod in `shared/config.ts`（合法席位；见根 `AGENTS.md` Zod/Eden 表）.
Web 一等 client 是 Eden（`treaty<App>`）；OpenAPI 是衍生面 — **Eden ≠ Zod**。

## Commands

```bash
bun dev              # --watch on :8032
bun test             # Bun test (unit + feature)
bun run typecheck    # tsc --noEmit
bun run db:generate  # drizzle-kit generate
bun run db:migrate   # drizzle-kit migrate
bun run build        # bun build --compile → crystalith-server
```

From repo root: `just dev-server`, `bun test apps/server/…`.

## Conventions

- One Elysia router per feature under `features/*/router.ts`
- OpenAPI via `@asteasolutions/zod-to-openapi` — **no** `@elysiajs/swagger` / `t.*`
- AI: AI SDK v7 only (`generateObject`, `streamText`, ToolLoopAgent/WorkflowAgent when needed)
- Config: `config/app.yaml` + `config/secret.env` (see `config/AGENTS.md`)

## Progress

Package rules defer to root `AGENTS.md` for repo-wide decisions.
