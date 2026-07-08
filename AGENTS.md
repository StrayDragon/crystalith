<!-- LLMANSPEC:START -->

# LLMAN Spec-Driven Development

This project uses llman SDD. Read `llmanspec/config.yaml` for project context and rules.

Use `/llman-sdd-onboard` to get started, then `/llman-sdd-*` skills for workflow.

Keep this managed block so `llman sdd update` can refresh it.
<!-- LLMANSPEC:END -->

# Crystalith v2 — AI Agent Guidelines

> This file replaces the v1 AGENTS.md. The repository is being rewritten in Bun + TypeScript (Elysia + React).
> The Python v1 implementation is preserved in `backend/py/` as a reference SSOT for the rewrite.

## Project Structure (v2 Target)

```
crystalith/
├── apps/
│   ├── server/           # ✅ Bun + Elysia (Phase 0 scaffold done)
│   │   └── src/
│   │       ├── server.ts           # Entry: Elysia HTTP server
│   │       ├── features/           # Business domains (notebooks, qa, sources, ...)
│   │       ├── shared/             # Cross-cutting (db, ai, config, vector, utils)
│   │       └── db/                 # Drizzle schema + migrations
│   └── web/               # Vite + React + TypeScript SPA (reused, API layer updated)
│       └── src/
│           ├── features/workspace/ # Main workspace UI
│           ├── api/                # API client layer (eden RPC replacing generated client)
│           └── shared/             # Shared UI utilities, Layer system
├── package.json          # ✅ Bun workspace root
├── config/               # Runtime config (app.yaml + secret.env)
├── llmanspec/            # Spec-driven development specs + changes
├── backend/py/           # 🔒 v1 Python reference SSOT — do NOT modify
└── scripts/              # Maintenance scripts
```

## Current State

The repo is in **v2 scaffold** phase on branch `v2-dev`:

- ✅ Phase 0 scaffold done: Bun workspace + Elysia server skeleton
- ✅ pnpm → bun migration complete
- ✅ Shared packages workspace set up (`packages/shared/`)
- Python v1 code is preserved intact in `backend/py/` as reference
- `llmanspec/specs/` contains ~34 business-level specs
- `llmanspec/changes/` contains 15 v2 migration changes (with dependency graph)

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

| Role                 | Technology                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Runtime              | **Bun** (single binary, bun:sqlite built-in)                                                              |
| Web Framework        | **Elysia** (eden RPC — zero-codegen type-safe client)                                                     |
| ORM                  | **Drizzle ORM** (bun-sqlite driver)                                                                       |
| AI Runtime           | **Vercel AI SDK v7** (`ai` + `@ai-sdk/*` — ToolLoopAgent + WorkflowAgent + generateObject + toolApproval) |
| Schema Validation    | **Zod** (shared frontend/backend)                                                                         |
| Vector Store         | **sqlite-vec** (in-process, same DB file)                                                                 |
| PDF Parsing          | **unpdf** (pdf.js based, MIT)                                                                             |
| Template Engine      | **Nunjucks** (already used in frontend)                                                                   |
| Desktop Distribution | **Tauri v2** + Bun sidecar (post-Phase-4)                                                                 |

## Build, Test, and Development Commands

From repo root (Bun workspace):

- `bun install` — install all dependencies (server + frontend + shared)
- `bun dev` — start full dev environment (parallel: server --watch + Vite HMR)
- `bun test` — run all tests
- `bun typecheck` — typecheck everything

Fast path (individual packages):

- `cd apps/server && bun dev` — Elysia server with hot reload (port 8032)
- `cd apps/web && bun dev` — Vite dev server (port 3000)
- `cd apps/web && bun test` — Vitest
- `cd apps/web && bun run typecheck` — TypeScript typechecking

## Coding Style

- **TypeScript/React**: 2-space indentation; `PascalCase` components; `useX` hooks; `camelCase` elsewhere
- **Layer System** (z-index): Use the unified Layer system in `apps/web/src/shared/layer/` — never hardcode z-index values
- Frontend uses `oxfmt` for formatting; match existing style

## v2 Migration Workflow

1. Run `llman sdd list` to see all active changes and their status
2. Read relevant v1 code in `backend/py/` to understand a feature
3. Design v2 implementation, then implement in `apps/server/` with Elysia + Drizzle + AI SDK
4. Frontend API calls gradually switch from generated client to eden RPC
5. Do NOT modify v1 Python code; Python is the reference SSOT

## Commit Guidelines

- Prefixes: `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:`
- Optional scope: `feat(server):`, `fix(frontend):`
- Keep subjects short, imperative, focused on one change

## Key Decisions

- **All 20+ features preserved** — research, analysis, studio, refine, etc. are core business
- **RAG strategies are pluggable** — registry pattern (Embed, BM25, Hybrid, Page Index, GraphRAG)
- **Built-in Eval Benchmark Harness** — Golden Dataset + LLM-as-Judge
- **Rivu dropped** — v2 replaces server-side state machine with message-embedded JSON components
- **Single binary distribution** — `bun build --compile` → ~75MB self-contained executable
- **Tauri desktop app** — post-Phase-4, Bun sidecar + Rust shell
- **AI SDK v7 是唯一 AI 层** — ToolLoopAgent(agent runtime) + WorkflowAgent(工作流) + generateObject(结构化输出) + toolApproval(HITL) + streamText(流式)。不引入 Pi agent-core、Mastra、LangGraph.js、XState 等任何第三方 agent/工作流框架。

## Agent-Specific Instructions

- For v2 design decisions, check `llmanspec/changes/` for the relevant change spec
- When implementing a feature, trace through the v1 Python code to understand behavior
- Use llman SDD workflow for spec changes: `/llman-sdd-*` skills
- For spec-driven development conventions, see `llmanspec/config.yaml`
