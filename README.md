# Crystalith v2

Notebook-centric AI workspace with pluggable RAG. Local-first, single-binary distribution.

**v2 is being rewritten in Bun + TypeScript** (Elysia + React + Vercel AI SDK + sqlite-vec).

## Quick Start (v2 — coming soon)

```bash
# Phase 0 scaffold (WIP)
bun install
just dev
# → Server on :8032, Frontend on :3000
```

## Tech Stack (v2)

| Layer | Technology |
|-------|-----------|
| Runtime | Bun (single binary, `--compile`) |
| Server | Elysia + Vercel AI SDK |
| Frontend | React 19 + Vite + TypeScript |
| Database | bun:sqlite + Drizzle ORM |
| Vector Store | sqlite-vec (in-process) |
| AI | @ai-sdk/openai + @ai-sdk/anthropic + ... |
| Desktop | Tauri v2 (post-Phase-4) |

## Development

See `AGENTS.md` for full guidelines. Key commands:

```bash
just dev           # Start development
just test          # Run tests
just check         # Quality gates
```

## v1 Python (Reference)

The v1 Python backend (`backend/py/`) is preserved as a reference SSOT during v2 rewrite.

## Migration Plan

See `llmanspec/changes/` for the full v2 migration plan and dependency graph.
