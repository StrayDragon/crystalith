# Crystalith Project Rules

This file is referenced by the root `AGENTS.md`. Use it to add project-specific
rules, context, or conventions that AI agents should follow.

## Project Context

Project-wide tech stack, commands, conventions, testing, git rules, and doc governance: see the project body of the root `AGENTS.md` (sections below the managed block).

**v2 Implementation Progress**: run `llman sdd list` for active change status.
See `_E2E.md` for E2E test patterns and known-issues reference.

Spec workflow paths:

- Canonical specs: `llmanspec/specs`
- Active change workspaces: `llmanspec/changes` (archive: `llmanspec/changes/archive`)
- v2 changes use `c<NN>-` prefix: c00 (foundation) → later align/cleanup changes. Lower number ≈ earlier foundation; run `llman sdd list` for truth.
- All `c<NN>` changes are batch:all — must read all design.md before implementing any.
- Do not archive a change solely because tasks.md marks ✅ — tasks.md may be incomplete.

Spec-workflow-specific notes:

- For v2, do NOT run `pnpm run api:sync` (v1 OpenAPI chain removed in v2).
- OpenAPI: use `@asteasolutions/zod-to-openapi` from shared Zod schemas. NOT `@elysiajs/swagger`.
- Stable entrypoints: `bun test`, `bun typecheck`.

## Artifact Rules

- design: For generated artifacts or injected blocks, include naming/marker rules and deterministic output expectations.
- design: For repo-wide refactors, include an explicit migration + rollback boundary.
- proposal: If the change renames paths/contracts, mark them as **BREAKING** and list old -> new explicitly.
- proposal: If the change introduces/updates generated artifacts, specify the SSOT, generator entrypoint, and drift gate command.
- specs: Use ADDED/MODIFIED/REMOVED/RENAMED sections as appropriate.
- specs: For MODIFIED requirements, copy the full updated requirement block (do not do partial diffs).
- tasks: Group tasks by dependency order and include explicit verification commands.
- tasks: Include drift-check commands whenever generated artifacts are involved.
