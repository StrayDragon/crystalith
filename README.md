# Crystalith v2

Notebook-centric AI workspace with pluggable RAG. Local-first, single-binary distribution.

**Stack**: Bun + TypeScript (Elysia + React 18.2 + Vercel AI SDK + sqlite-vec).

## Quick Start

```bash
bun install
just dev
# → Server on :8032, Frontend on :3000
```

Or: `bun dev` from the repo root.

## Tech Stack

| Layer        | Technology                       |
| ------------ | -------------------------------- |
| Runtime      | Bun (single binary, `--compile`) |
| Server       | Elysia + Vercel AI SDK v7        |
| Frontend     | React 18.2 + Vite + TypeScript   |
| Database     | bun:sqlite + Drizzle ORM         |
| Vector Store | sqlite-vec (in-process)          |
| AI           | `@ai-sdk/*` providers            |
| Desktop      | Tauri v2 (c13, pending)          |

## Development

See `AGENTS.md` and `PROGRESS.v2.md`. Key commands:

```bash
just dev           # Start development
just test          # Run tests
just check         # Quality gates (typecheck + lint + format)
```

## v1 Python (Reference)

`backend/py/` was removed in c14 (2026-07-15). All v1 behavior has been parity-confirmed in the TypeScript v2 implementation.

## Migration / Progress

- Live status: `PROGRESS.v2.md`
- Specs & changes: `llmanspec/`
- Remaining: c13 (distribution) → v2.0.0
