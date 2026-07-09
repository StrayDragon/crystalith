# c00-add-v2-server-foundation

batch: all

## Why

v1 Python backend (FastAPI + pydantic-ai + SQLAlchemy + ChromaDB) must be rewritten in Bun + TypeScript for single-binary distribution, shared types, and unified AI runtime. Phase 0 establishes the workspace structure, build tooling, and minimal Elysia server skeleton.

## What Changes

- **NEW** `package.json` at repo root — Bun workspace spanning `apps/server/`, `apps/web/`, `packages/*`
- **NEW** `apps/server/` package — Elysia HTTP server skeleton with `/health` and `/v2/` endpoints, `bun --watch` hot reload
- **NEW** `packages/shared/` package — shared Zod schemas and types for server ↔ frontend
- **NEW** `bun.lock` — single workspace lockfile replacing `pnpm-lock.yaml`
- **MODIFIED** `AGENTS.md` — updated build/dev commands and project structure for v2
- **MODIFIED** `justfile` — simplified to v2 bun commands
- **MODIFIED** `.github/workflows/ci.yml` — bun setup, server CI job commented out (to enable later)
- **MODIFIED** `apps/web/` — migrate from pnpm to bun, clean stale vite aliases (rivu, slidev)
- **REMOVED** `pnpm-lock.yaml`, `pnpm-workspace.yaml` — replaced by root `bun.lock`

## Capabilities

- architecture-core

## Impact

- **BREAKING**: Frontend now uses `bun` instead of `pnpm` for dependency management and scripts.
- No v1 Python code is modified.
- Server is a minimal skeleton — no business endpoints yet.
