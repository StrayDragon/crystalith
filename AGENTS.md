<!-- LLMANSPEC:START -->

# LLMAN Spec-Driven Development

This project uses llman SDD. Read `llmanspec/config.yaml` for project context and rules.

Use `/llman-sdd-explore` to get started, then follow the pipeline: `/llman-sdd-propose` → `/llman-sdd-apply` → `/llman-sdd-verify` → `/llman-sdd-archive`.

Keep this managed block so `llman sdd update` can refresh it.
<!-- LLMANSPEC:END -->

# Crystalith v2 — AI Agent Guidelines

> Bun + TypeScript rewrite (Elysia + React). Python v1 lives in `backend/py/` as a **reference SSOT** — do not modify it.
> **Progress SSOT**: always read `PROGRESS.v2.md` first (status board, current batch, gaps, handoff).

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
│           ├── api/                # eden RPC (+ legacy generated types until c14)
│           └── shared/             # Shared UI utilities, Layer system
├── packages/
│   ├── shared/            # Zod schemas + types SSOT
│   └── crystalith-slidev/ # Slidev integration
├── config/                # Runtime config (app.yaml + secret.env)
├── llmanspec/             # Spec-driven development specs + changes
├── backend/py/            # 🔒 v1 Python reference SSOT — do NOT modify
├── data/                  # Runtime DB + uploads (gitignored)
└── scripts/               # Maintenance scripts
```

## Current State

> Detail: `PROGRESS.v2.md`. Summary as of 2026-07-11:

- ✅ Core server + data layer + AI runtime + RAG + feature routers (c00–c12, c15–c41)
- ✅ Frontend API migration largely done (c35); residual type imports from `api/generated/` until c14
- ✅ Behavior-align batches c36–c40 + multi-round review complete
- ⏸️ **c13** distribution (Tauri / single-binary) — blocked on human auth
- ⏸️ **c14** cleanup delivery (delete v1 Python, generated client, tag v2.0.0) — blocked on human auth
- 🔄 Active SDD hygiene: some DONE changes still have unchecked/partial `tasks.md` (see `llman sdd list`) — do not archive until tasks match reality

## Reference: v1 Python Implementation

`backend/py/` is the Python v1 codebase (FastAPI + pydantic-ai + SQLAlchemy + ChromaDB).
Read it to understand **what** a feature does, then implement a better **how** in TypeScript.

Key entry points:

- `backend/py/src/crystalith/features/*/` — business domains
- `backend/py/src/crystalith/web/routers.py` — route registration
- `backend/py/src/crystalith/shared/ai/` — AI agent runtime
- `backend/py/src/crystalith/db/models.py` — SQLAlchemy tables

## v2 Stack

| Role                 | Technology                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Runtime              | **Bun** (single binary, bun:sqlite built-in)                                                              |
| Web Framework        | **Elysia** (eden RPC — zero-codegen type-safe client)                                                     |
| ORM                  | **Drizzle ORM** (bun-sqlite driver)                                                                       |
| AI Runtime           | **Vercel AI SDK v7** (`ai` + `@ai-sdk/*` — ToolLoopAgent + WorkflowAgent + generateObject + toolApproval) |
| Schema Validation    | **Zod** (shared frontend/backend via `packages/shared`)                                                   |
| Vector Store         | **sqlite-vec** (in-process, same DB file)                                                                 |
| PDF Parsing          | **unpdf**                                                                                                 |
| Template Engine      | **Nunjucks** (frontend)                                                                                   |
| Desktop Distribution | **Tauri v2** + Bun sidecar (c13)                                                                          |

## Build, Test, and Development Commands

From repo root:

- `bun install` — install all dependencies
- `bun dev` / `just dev` — server --watch + Vite HMR
- `bun test` — run tests
- `bun typecheck` — typecheck everything

Fast path:

- `cd apps/server && bun dev` — Elysia server (port 8032)
- `cd apps/web && bun dev` — Vite (port 3000)
- `cd apps/web && bun test` — Vitest
- `cd apps/web && bun run typecheck` — frontend typecheck

## Coding Style

- **TypeScript/React**: 2-space indentation; `PascalCase` components; `useX` hooks; `camelCase` elsewhere
- **Layer System** (z-index): Use `apps/web/src/shared/layer/` — never hardcode z-index
- Formatter: `oxfmt`; linter: `oxlint`

## v2 Workflow

1. Read `PROGRESS.v2.md` (`<!-- CURRENT -->` batch + known gaps)
2. Run `llman sdd list` for active change status (do not assume PROGRESS ✅ means tasks/archive are clean)
3. Read relevant v1 code in `backend/py/` for behavior
4. Implement in `apps/server/` / `apps/web/` / `packages/shared/`
5. Do NOT modify `backend/py/`

## Commit Guidelines

- Prefixes: `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:`
- Optional scope: `feat(server):`, `fix(frontend):`
- Keep subjects short, imperative, focused on one change

## Key Decisions

- **All 20+ features preserved** — research, analysis, studio, refine, etc. are core business
- **RAG strategies are pluggable** — registry (Embed, BM25, Hybrid, Page Index; GraphRAG later)
- **Built-in Eval Benchmark Harness** — Golden Dataset + LLM-as-Judge
- **Rivu dropped** — message-embedded JSON components instead of server-side state machine
- **Single binary** — `bun build --compile`
- **AI SDK v7 only** — no Pi agent-core, Mastra, LangGraph.js, XState, etc.
- **Zod SSOT** — types only in `packages/shared`; no `@elysiajs/swagger` / Elysia `t.*`
- **React locked at 18.2.0** for now (see PROGRESS open decisions)

## Agent-Specific Instructions

- Progress / handoff: `PROGRESS.v2.md`
- Design decisions: `llmanspec/changes/`
- Package-local rules: `apps/server/AGENTS.md`, `apps/web/AGENTS.md`, `config/AGENTS.md`, `backend/py/AGENTS.md`
- Spec workflow: `/llman-sdd-*` skills; conventions in `llmanspec/config.yaml`
