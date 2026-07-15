# add-config-schema-descriptions — Tasks

## Phase 0: i18n infrastructure

- [x] Install `typesafe-i18n` as devDependency in packages/shared
- [x] Create `.typesafe-i18n.json` config (baseLocale: zh)
- [x] Create `packages/shared/src/i18n/zh/index.json` — Chinese locale dictionary (~110 keys)
- [x] Create `packages/shared/src/i18n/i18n-types.ts` — types for translation keys
- [x] Create `packages/shared/src/i18n/i18n-util.ts` — `L` object for key lookups
- [x] Update `packages/shared/src/schemas/i18n.ts` — `desc()` helper backed by `L` object
- [x] Update `AGENTS.md` — add "Schema Descriptions & i18n" section
- [x] Verify: `bun typecheck` passes

## Phase A: config.ts Zod schema .describe()

- [x] Add `desc` import in config.ts
- [x] `SsrfPolicyConfigSchema` — 5 fields with `.describe(desc('ssrf.*'))`
- [x] `AppSettingsSchema` — 1 field with `.describe(desc('app.*'))`
- [x] `AiSettingsSchema` — 2 fields with `.describe(desc('ai.*'))`
- [x] `ConcurrencySettingsSchema` — 3 fields with `.describe(desc('concurrency.*'))`
- [x] `EmbeddingSettingsSchema` — 2 fields with `.describe(desc('embedding.*'))`
- [x] `ContextWindowSettingsSchema` — 3 fields with `.describe(desc('context_window.*'))`
- [x] `SearXNGSettingsSchema` — 4 fields with `.describe(desc('search.searxng.*'))`
- [x] `CompletionOptionsSchema` — 5 fields with `.describe(desc('completion.*'))`
- [x] `StorageSettingsSchema` — 1 field with `.describe(desc('storage.*'))`
- [x] `OptionalServiceEntrySchema` — 3 fields with `.describe(desc('optional_services.*'))`
- [x] Verify: `just gen-app-schema` now includes descriptions

## Phase B: Shared API schema .describe()

- [x] `notebook.ts` — 4 fields with `.describe(desc('notebook.*'))`
- [x] `session.ts` — 5 fields with `.describe(desc('session.*'))`
- [x] `message.ts` — 5 fields with `.describe(desc('message.*'))`
- [x] `source.ts` — 6 fields with `.describe(desc('source.*'))`
- [x] `output.ts` — 4 fields with `.describe(desc('output.*'))`
- [x] `template.ts` — 2 fields with `.describe(desc('template.*'))`
- [x] Verify: `bun typecheck` passes for packages/shared

## Phase C: Final validation

- [x] `bun typecheck` passes across all packages
- [x] `just qa` passes (typecheck + lint + format-check + test) — 272 pass, 0 fail
- [x] `config/app.schema.gen.json` regenerated with descriptions
- [x] `llman sdd validate add-config-schema-descriptions --strict --no-interactive`
