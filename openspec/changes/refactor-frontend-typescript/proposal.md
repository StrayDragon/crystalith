## Why
The frontend is currently JavaScript-first with a loose, flat structure. Moving to TypeScript, reorganizing by feature, and switching to Vite for faster dev/build feedback will improve maintainability and iteration speed without changing UI behavior.

## What Changes
- Add Vite + TypeScript tooling and configuration for the frontend.
- Replace CRA scripts with Vite dev/build/test commands.
- Convert the entry, tests, and workspace feature files to TypeScript.
- Reorganize `src/` into `app/`, `features/`, and `shared/` with colocated feature code.
- Split the workspace page into smaller typed components and typed API helpers.
- Update `AGENTS.md` to reflect the new frontend structure and commands.

## Impact
- Affected specs: frontend-structure (new), workspace-ui (no behavior change expected)
- Affected code: frontend/web/src/**, frontend/web/package.json, frontend/web/tsconfig.json (new), frontend/web/vite.config.ts (new), frontend/web/index.html (relocated), AGENTS.md
