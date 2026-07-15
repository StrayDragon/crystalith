# add-config-ssot-autogen — Tasks

## Phase 1: Artifact creation

- [x] Create change directory and artifact skeleton
- [x] Write proposal.md
- [x] Write delta spec (configuration-governance) with r9–r11 + scenarios
- [x] Write design.md
- [x] Write tasks.md
- [x] Validate change: `llman sdd validate add-config-ssot-autogen --strict --no-interactive`

## Phase 2: Zod env schema SSOT

- [x] Add `zod-to-json-schema` as devDependency to workspace root (later replaced with custom converter — Zod v4 incompatibility)
- [x] Create `packages/shared/src/schemas/env.ts`:
  - Define `EnvTarget` const enum (`build-run`, `secrets`)
  - Define `BuildRunEnvSchema` with all `.env` variables (with `.describe()`, defaults)
  - Define `SecretsEnvSchema` with all `secret.env` variables (with `.describe()`)
  - Define `DeprecatedEnvSchema` for backward-compat vars
  - Export `getAllEnvDescriptors()` for generator scripts
  - Verify: `bun typecheck` passes
- [x] Scan entire codebase to ensure all `process.env.*` and `{{ env.* }}` / `{{ secret.* }}` references are captured in the schema
  - Verify: complete env var inventory compiled from grep results

## Phase 3: `.example` auto-generation script

- [x] Create `scripts/gen-env-examples.ts`:
  - Imports `EnvTarget`, `EnvEntryDescriptor`, `getAllEnvDescriptors` from env.ts
  - Generates `.env.example` with header + active config + deprecated sections
  - Generates `config/secret.env.example` with header + secrets list
  - Supports `--check` flag: generate to tempdir, diff vs existing, exit 1 if different
  - Verify: `bun scripts/gen-env-examples.ts` creates matching `.example` files
  - Verify: `bun scripts/gen-env-examples.ts --check` returns 0 after generation

## Phase 4: YAML JSON Schema auto-generation script

- [x] Create `scripts/gen-app-schema.ts`:
  - Imports Zod schemas from `apps/server/src/shared/config.ts`
  - Maps 10 YAML sections to their Zod schemas
  - Custom `zodToJson()` converter handles Zod v4's `field.type`, `field.description`, `_def.shape`, `_def.element`
  - Assembles into `config/app.schema.gen.json` with `$schema`, `$id`, `title`, `description`
  - Supports `--check` flag
  - Verify: `bun scripts/gen-app-schema.ts` generates valid JSON Schema
  - Verify: `bun scripts/gen-app-schema.ts --check` returns 0

## Phase 5: Justfile + Pre-commit integration

- [x] Update `justfile`:
  - Add `gen-env-examples` recipe
  - Add `gen-app-schema` recipe
  - Add `check-env-examples` recipe
  - Add `check-app-schema` recipe
- [x] Update `.pre-commit-config.yaml`:
  - Add `check-env-examples` local hook as first hook
- [x] Verify: `just gen-env-examples` / `just gen-app-schema` work
  - Verify: `just check-env-examples` / `just check-app-schema` pass

## Phase 6: `init_config.sh` alignment

- [x] Update `scripts/init_config.sh`:
  - Add comment header referencing SSOT `packages/shared/src/schemas/env.ts`
  - Keep existing key lists for practical shell-based setup

## Phase 7: Final validation

- [x] `bun typecheck` passes across all packages
- [x] `just qa` passes (typecheck + lint + format-check + test) — 272 pass, 0 fail
- [x] `llman sdd validate add-config-ssot-autogen --strict --no-interactive`
