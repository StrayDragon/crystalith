<!-- LLMANSPEC:START -->

# LLMAN Spec-Driven Development

This project uses llman SDD. Read `llmanspec/config.yaml` for project context and rules.

Use `/llman-sdd-explore` to get started, then follow the pipeline: `/llman-sdd-propose` → `/llman-sdd-apply` → `/llman-sdd-verify` → `/llman-sdd-archive`.

Keep this managed block so `llman sdd update` can refresh it.
<!-- LLMANSPEC:END -->

# Crystalith v2 — AI Agent Guidelines

> Bun + TypeScript rewrite (Elysia + React). **v1 Python SSOT (`backend/py/`) has been removed as of c14** — all behavior is now parity-confirmed in TypeScript.
> **Status**: c00–c62 all DONE, c14 DONE, c13 BLOCKED (distribution).

## Project Structure

```
crystalith/
├── apps/
│   ├── server/           # Bun + Elysia + Drizzle + AI SDK + sqlite-vec
│   │   └── src/
│   │       ├── server.ts           # Entry: Elysia HTTP server
│   │       ├── features/           # Business domains
│   │       ├── ai/                 # Provider registry, generate, stream
│   │       ├── rag/                # Chunk/embed/search + strategy registry
│   │       ├── shared/             # Config, queue, net, extraction
│   │       └── db/                 # Drizzle schema + migrations
│   └── web/               # Vite + React + TypeScript SPA
│       └── src/
│           ├── features/workspace/ # Main workspace UI
│           ├── api/                # eden RPC; types in shared-types.ts
│           └── shared/             # Shared UI utilities, Layer system
├── packages/
│   ├── shared/            # Zod schemas + types SSOT
│   │   └── src/schemas/   # notebook, session, message, source, qa, output,
│   │                      # research, analysis, studio, refine, model, etc.
│   └── crystalith-slidev/ # Slidev integration
├── config/                # Runtime config (app.yaml + secret.env)
├── llmanspec/             # Spec-driven development specs + changes
├── data/                  # Runtime DB + uploads (gitignored)
└── scripts/               # Maintenance scripts
```

## Current State

- ✅ All c00–c62 completed (63 changes); v1 parity confirmed through E2E
- ✅ Frontend: all output renderers aligned with v1 interactive components
- ✅ c14: `backend/py/` + `api/generated/` deleted, types migrated to `shared-types.ts`
- ⏸️ **c13** distribution (Tauri / single-binary) — blocked on human auth

## v2 Stack

| Role                 | Technology                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Runtime              | **Bun** (single binary, bun:sqlite built-in)                                                              |
| Web Framework        | **Elysia** (eden RPC — zero-codegen type-safe client)                                                     |
| ORM                  | **Drizzle ORM** (bun-sqlite driver)                                                                       |
| AI Runtime           | **Vercel AI SDK v7** (`ai` + `@ai-sdk/*`)                                                                |
| Schema Validation    | **Zod** (shared frontend/backend via `packages/shared`)                                                   |
| Vector Store         | **sqlite-vec** (in-process, same DB file)                                                                 |
| PDF Parsing          | **unpdf**                                                                                                 |
| Template Engine      | **Nunjucks** (frontend)                                                                                   |
| Desktop Distribution | **Tauri v2** + Bun sidecar (c13)                                                                          |

## Build, Test, and Development Commands

From repo root:

- `bun install` — install all dependencies
- `bun dev` / `just dev` — Overmind (`Procfile`: server + web + slidev)
- `bun run dev:server` / `just dev-server` — server only (:8032)
- `bun run dev:web` / `just dev-web` — Vite only (:3000)
- `bun test` — run server tests
- `bun typecheck` — typecheck everything

Fast path:
- `cd apps/server && bun dev` — Elysia server (port 8032)
- `cd apps/web && bun dev` — Vite (port 3000)
- `just dev-connect server` — attach to Overmind process
- `just dev-quit` — stop Overmind session

## Coding Style

- **TypeScript/React**: 2-space indentation; `PascalCase` components; `useX` hooks; `camelCase` elsewhere
- **Layer System**: Use `apps/web/src/shared/layer/` — never hardcode z-index
- Formatter: `oxfmt`; linter: `oxlint`

## Architecture Decisions

### Zod SSOT

All types: `packages/shared/src/schemas/`. Elysia 1.4+ consumes Zod v4 natively.
**No** `@elysiajs/swagger`, **no** Elysia `t.*`. OpenAPI via `@asteasolutions/zod-to-openapi`, Scalar UI at `/openapi`.

```
packages/shared/src/schemas/   ← SSOT
    ├──→ server routes (body: z.*)
    ├──→ eden treaty (treaty<App>)
    └──→ /openapi.json → Scalar UI
```

### AI SDK v7 Only

- `generateObject({ schema: Zod })` ✅ | `streamText` / `fullStream` ✅
- `ToolLoopAgent` — 🟡 Post-c13
- **Banned**: Pi agent-core, Mastra, LangGraph.js, XState, Inngest, Temporal

### Single Binary

`bun build --compile` → ~75MB. All deps bundled (sqlite-vec, unpdf, cheerio).

### RAG Strategies

Pluggable registry: Embed, BM25, Hybrid, Page Index. GraphRAG / HyDE / Self-RAG deferred.

### Provider Registry

Whitelist + dynamic `import()`, no switch-case. 90% of providers go through `openai-compatible`.

### Other

- React 18.2.0 locked
- Rivu dropped (message-embedded JSON components instead of server state machine)
- Built-in Eval Benchmark Harness (Golden Dataset + LLM-as-Judge)

## v2 Workflow

1. Run `llman sdd list` for active change status
2. See `_E2E.md` for E2E test patterns and known issues
3. Implement in `apps/server/` / `apps/web` / `packages/shared/`
4. See package docs: `apps/server/AGENTS.md`, `apps/web/AGENTS.md`, `config/AGENTS.md`

## Commit Guidelines

- Prefixes: `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:`
- Optional scope: `feat(server):`, `fix(frontend):`
- Keep subjects short, imperative, focused on one change

## Agent-Specific Instructions

- SDD workflow: `/llman-sdd-*` skills; conventions in `llmanspec/config.yaml`
- Design decisions: `llmanspec/changes/`
- Package-level rules: `apps/server/AGENTS.md`, `apps/web/AGENTS.md`, `config/AGENTS.md`
