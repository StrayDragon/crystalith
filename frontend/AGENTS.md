# frontend — Crystalith v2 Frontend

> The frontend React SPA (`frontend/web/`) is reused in v2 with minimal changes.
> The API client layer switches from generated OpenAPI client to Elysia eden RPC (gradually).

## v2 Changes from v1

| v1 | v2 |
|----|-----|
| `@hey-api/openapi-ts` generated client in `src/api/generated/` | **Elysia eden RPC** — type-safe, zero codegen |
| `pnpm run api:sync` (fetch + generate) | **Removed** — types inferred directly from server |
| `pnpm` package manager | **Bun** (for `bun install`) |
| `packages/crystalith-slidev/` | **Removed** — Studio slides integrated differently in v2 |
| `@tambo-ai/react`, `rivu-*` | **Removed** — Rivu state machine dropped |

## Structure (unchanged)

```
frontend/web/
├── src/
│   ├── app/              # App entry + global styles
│   ├── features/         # Feature modules
│   │   └── workspace/    # Main workspace (domains, layout, shared)
│   ├── api/              # API client layer (eden RPC replacing generated/)
│   └── shared/           # Shared utilities, Layer system
├── public/               # Static assets
├── vite.config.ts
└── package.json
```

## Build, Test, and Development

```bash
cd frontend/web
bun install             # Install dependencies
bun dev                 # Start Vite dev server (HMR on :3000)
bun test                # Run Vitest
bun run test:ci         # CI test suite
bun run typecheck       # TypeScript typecheck
bun run lint            # Incremental lint
bun run format          # Format with oxfmt
bun run build           # Production build → dist/
```

## API Client Migration (Gradual)

During v2 transition, the generated client (`src/api/generated/`) is kept as a reference/fallback.
As each backend endpoint is implemented in v2 (Elysia), the corresponding frontend call switches to eden RPC.

```
v1:  import { notebooksApi } from '@/api/generated';    // generated from OpenAPI
v2:  const { data } = await api.notebooks.list();        // eden RPC — fully typed
```

## Layer System

Use the unified Layer system (`src/shared/layer/`) for z-index management:
- `base` (0) → `dropdown` (100) → `popover` (200) → `modal` (300) → `toast` (400) → `tooltip` (500)
- Never hardcode z-index values.

## Commit Guidelines

- Prefixes: `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:`
- Optional scope: `feat(frontend):`, `fix(workspace):`
