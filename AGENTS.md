# Crystalith v2 — AI Agent Guidelines

> This file replaces the v1 AGENTS.md. The repository is being rewritten in Bun + TypeScript (Elysia + React).
> The Python v1 implementation is preserved in `backend/py/` as a reference SSOT for the rewrite.

## Project Structure (v2 Target)

```
crystalith/
├── server/               # Bun + Elysia + AI SDK (to be created in Phase 0)
│   └── src/
│       ├── server.ts           # Entry: Elysia HTTP server
│       ├── features/           # Business domains (notebooks, qa, sources, ...)
│       ├── shared/             # Cross-cutting (db, ai, config, vector, utils)
│       └── db/                 # Drizzle schema + migrations
├── frontend/web/         # Vite + React + TypeScript SPA (reused, API layer updated)
│   └── src/
│       ├── features/workspace/ # Main workspace UI
│       ├── api/                # API client layer (eden RPC replacing generated client)
│       └── shared/             # Shared UI utilities, Layer system
├── config/               # Runtime config (app.yaml + secret.env)
├── llmanspec/            # Spec-driven development specs + changes
├── UPGRADES/             # v2 migration research docs (read before working)
├── backend/py/           # 🔒 v1 Python reference SSOT — do NOT modify
└── scripts/              # Maintenance scripts
```

## Current State

The repo is in **v2 baseline cleanup** phase on branch `v2-dev`:
- Python v1 code is preserved intact in `backend/py/` as reference
- CI/pre-commit are minimal (frontend-only) until server scaffold is ready
- `llmanspec/specs/` contains ~33 business-level specs (Python-implementation-tied ones removed)
- `UPGRADES/` contains all v2 migration research and decisions

## Reference: v1 Python Implementation

`backend/py/` is the Python v1 codebase (FastAPI + pydantic-ai + SQLAlchemy + ChromaDB).
During v2 rewrite, treat this as a **reference SSOT** for understanding feature behavior and domain logic.
Read it to understand **what** the feature does, then design a better **how** in TypeScript.
Do NOT blindly copy/paste — understand the intent and optimize for the Bun/Elysia/ai-sdk stack.

Key entry points in v1:
- `backend/py/src/crystalith/features/*/` — business domains
- `backend/py/src/crystalith/web/routers.py` — route registration (18 routers)
- `backend/py/src/crystalith/shared/ai/` — AI agent runtime (pydantic-ai + pydantic-graph)
- `backend/py/src/crystalith/db/models.py` — 17 SQLAlchemy tables

## v2 Target Stack

| Role | Technology |
|------|-----------|
| Runtime | **Bun** (single binary, bun:sqlite built-in) |
| Web Framework | **Elysia** (eden RPC — zero-codegen type-safe client) |
| ORM | **Drizzle ORM** (bun-sqlite driver) |
| AI Runtime | **Vercel AI SDK** (`ai` + `@ai-sdk/openai` + `@ai-sdk/anthropic` + ...) |
| Schema Validation | **Zod** (shared frontend/backend) |
| Vector Store | **sqlite-vec** (in-process, same DB file) |
| PDF Parsing | **unpdf** (pdf.js based, MIT) |
| Template Engine | **Nunjucks** (already used in frontend) |
| Desktop Distribution | **Tauri v2** + Bun sidecar (post-Phase-4) |

## Build, Test, and Development Commands

From repo root:
- `just install` — install frontend dependencies (`bun install`)
- `just dev` — start frontend dev server (Vite HMR on :3000)
- `just test` / `just test-frontend` — run frontend tests
- `just typecheck` / `just lint` / `just format-check` — code quality
- `just build-web` — production frontend build
- `just upsert-env-configs` — initialize .env + config/secret.env from shell

Frontend (direct):
- `cd frontend/web && bun install` — install JS deps
- `cd frontend/web && bun dev` — Vite dev server
- `cd frontend/web && bun test` — Vitest
- `cd frontend/web && bun run typecheck` — TypeScript typechecking

## Coding Style

- **TypeScript/React**: 2-space indentation; `PascalCase` components; `useX` hooks; `camelCase` elsewhere
- **Layer System** (z-index): Use the unified Layer system in `frontend/web/src/shared/layer/` — never hardcode z-index values
- Frontend uses `oxfmt` for formatting; match existing style

## v2 Migration Workflow

1. Read `UPGRADES/00-v2-migration-plan.md` for the full plan
2. Read relevant v1 code in `backend/py/` to understand a feature
3. Design v2 implementation, then implement in `server/` with Elysia + Drizzle + AI SDK
4. Frontend API calls gradually switch from generated client to eden RPC
5. Do NOT modify v1 Python code; Python is the reference SSOT

## Commit Guidelines

- Prefixes: `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:`
- Optional scope: `feat(server):`, `fix(frontend):`
- Keep subjects short, imperative, focused on one change

## Key Decisions (from UPGRADES/)

- **All 20+ features preserved** — research, analysis, studio, refine, etc. are core business
- **RAG strategies are pluggable** — registry pattern (Embed, BM25, Hybrid, Page Index, GraphRAG)
- **Built-in Eval Benchmark Harness** — Golden Dataset + LLM-as-Judge
- **Rivu dropped** — v2 replaces server-side state machine with message-embedded JSON components
- **Single binary distribution** — `bun build --compile` → ~75MB self-contained executable
- **Tauri desktop app** — post-Phase-4, Bun sidecar + Rust shell

## Agent-Specific Instructions

- For v2 design decisions, read `UPGRADES/` docs first
- When implementing a feature, trace through the v1 Python code to understand behavior
- Use llman SDD workflow for spec changes: `/llman-sdd-*` skills
- For spec-driven development conventions, see `llmanspec/config.yaml`
