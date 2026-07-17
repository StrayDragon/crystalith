# apps/web — Vite + React + TypeScript SPA

## Project Structure & Module Organization

- Source code: `src/`
- Static assets: `public/`
- `src/features/workspace/` — main workspace feature
  - `domains/` — business domains (notebooks, sessions, messages, sources, outputs, refine, studio, research)
  - `layout/`, `shared/`, `app/` — workspace scaffolding
- `src/api/` — API client layer (eden RPC primary; types in `shared-types.ts`)
- `src/shared/` — shared utilities, Layer system, types

## Build, Test, and Development Commands

```bash
bun install              # Install dependencies
bun dev                  # Vite dev server (HMR on :3000)
bun test                 # Vitest (watch mode)
bun run test:ci          # CI quality gate (stable suite)
bun run test:core        # Minimal UI core regression suite
bun run lint             # Incremental oxlint
bun run lint:all         # Full oxlint
bun run format           # oxfmt
bun run format:check     # Format check (no write)
bun typecheck            # TypeScript typecheck
bun run build            # Production build → dist/
bun preview              # Preview production build
```

## API Client

- **Primary**: Elysia eden RPC via `src/api/eden.ts` (type-safe, no codegen)
- **Legacy removal (c14)**: `src/api/generated/` deleted; types migrated to `shared-types.ts`

## Coding Style & Naming Conventions

- TypeScript/React: 2-space indentation
- Components: `PascalCase`
- Hooks: `useX`
- Tests: `*.test.tsx` (colocated with source)
- CSS/Tailwind: global styles in `src/app/index.css`; feature styles alongside components
- Formatter: `oxfmt` — keep reformatting scoped

## Layer System (z-index Management)

**Never use hardcoded z-index values.** Use the unified Layer system:

| Level      | Value | Usage                                   |
| ---------- | ----- | --------------------------------------- |
| `base`     | 0     | Normal content                          |
| `dropdown` | 100   | Dropdown menus (MenuList)               |
| `popover`  | 200   | Popovers (PopoverContent, Select menus) |
| `modal`    | 300   | Modal dialogs                           |
| `toast`    | 400   | Toast notifications                     |
| `tooltip`  | 500   | Tooltips (always on top)                |

```tsx
// React components — use the hook
import { useLayer } from '../shared/layer';
const { style } = useLayer('modal');

// Material Tailwind components — use LAYER_LEVELS
import { LAYER_LEVELS } from '../shared/layer';
<MenuList style={{ zIndex: LAYER_LEVELS.dropdown }}>...</MenuList>;
```

- `LayerProvider` is already wrapped in `App.tsx`
- Each level has 100 slots for future expansion

## Testing Guidelines

- Vitest + React Testing Library
- Colocate tests with `*.test.tsx` naming
- Run targeted tests for changed areas
- `test:ci` runs deterministic quality gate; `test:core` covers critical paths

## Configuration & Security

- Settings via `config/app.yaml`
- Never commit API keys or tokens
