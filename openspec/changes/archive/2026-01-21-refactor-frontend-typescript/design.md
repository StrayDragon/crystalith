## Context
The frontend is a CRA app with Tailwind styles, but most of the UI lives in a single `WorkspacePage.js` file and the project is JavaScript-first. This makes future feature growth and refactors harder, and dev/build feedback is slower than it needs to be.

## Goals / Non-Goals
- Goals:
  - Adopt TypeScript for the frontend with Vite tooling.
  - Organize code by feature with colocated components/styles.
  - Reduce the size of the workspace page by splitting components.
  - Improve dev/build feedback loops.
- Non-Goals:
  - UI redesign or behavior changes.
  - Backend API changes.
  - Migrating away from Tailwind.

## Decisions
- Switch from CRA (`react-scripts`) to Vite for faster local development.
- Introduce TypeScript with standard Vite configuration and `@types` packages.
- Use Vite's React plugin and keep `public/` assets.
- Use Vitest to replace the CRA test runner.
- Use a feature-based layout:
  - `src/app/` for entry, App shell, and global setup.
  - `src/features/workspace/` for workspace page, components, hooks, styles, and API helpers.
  - `src/shared/` for shared UI primitives, utilities, and types.
- Colocate components, hooks, and styles per feature to avoid a flat `src/` root.

## Risks / Trade-offs
- Type errors may surface during migration and require incremental typing.
- Moving files will require updating imports and test paths.
- Vite migration requires updating scripts and `index.html`.

## Migration Plan
1. Add Vite + TypeScript dependencies and `tsconfig.json`.
2. Add `vite.config.ts`, move `index.html`, and update scripts.
3. Convert entry/test utilities to `.ts`/`.tsx`.
4. Move workspace feature into `src/features/workspace` and update imports.
5. Split `WorkspacePage` into smaller typed components and helpers.
6. Run `pnpm test` and `pnpm run build` to validate.
