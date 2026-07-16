# c65 Implementation Prompt (for implementer agent)

> **Change id:** `c65-api-wire-camelcase`
> **Mode:** implement tasks only — **do NOT archive** unless the human explicitly asks.
> **Reviewer:** a separate agent will review against this prompt + `proposal.md` / `design.md` / `tasks.md` / deltas.
> **Locale:** zh-CN project; code/comments match repo style.

---

## Mission

Make **all Crystalith HTTP/SSE JSON wire fields camelCase**, with `packages/shared` Zod as SSOT, Elysia validating the same schemas, and the web app consuming types via **Eden `treaty<App>` + `@crystalith/shared`**. Remove snake→camel API normalizers and parallel `Api*` / `shared-types` SSOTs.

This is **BREAKING**. No dual-write. No snake wire compat layer.

## Read first (SSOT)

1. `llmanspec/changes/c65-api-wire-camelcase/proposal.md`
2. `llmanspec/changes/c65-api-wire-camelcase/design.md`
3. `llmanspec/changes/c65-api-wire-camelcase/tasks.md`
4. Deltas under `llmanspec/changes/c65-api-wire-camelcase/specs/**`
5. Prior art: c64 Citation camelCase (`packages/shared` `CitationSchema`, `hydrateCitations`)

Run: `llman sdd show c65-api-wire-camelcase` and `llman sdd status c65-api-wire-camelcase`.

## Hard constraints

| Do                                                  | Don't                                              |
| --------------------------------------------------- | -------------------------------------------------- |
| Rename **JSON** keys to camelCase                   | Rename SQLite/Drizzle **column** names             |
| Keep `/v2` paths + SSE event names (`chunk`/`done`) | Bring back `@hey-api/openapi-ts`                   |
| Keep OpenAPI/Scalar working                         | Break Tauri/single-binary strategy                 |
| Delete snake→camel API maps                         | Keep accepting both `notebook_id` and `notebookId` |
| Prefer Eden + shared types                          | Grow `apps/web/src/api/shared-types.ts`            |

## Naming cheat sheet

```
notebook_id → notebookId
session_id → sessionId
source_ids → sourceIds
chunk_ids → chunkIds
message_id → messageId
created_at → createdAt
updated_at → updatedAt
error_code → errorCode
retry_after → retryAfter
no_evidence_reason → noEvidenceReason
shared_state → sharedState
shared_state_revision → sharedStateRevision
mime_type → mimeType
parser_type → parserType
chunk_count → chunkCount
config_schema → configSchema
frontend_bundle → frontendBundle
render_descriptor → renderDescriptor
system_prompt → systemPrompt
is_builtin → isBuiltin
output_type → outputType
generation_config → generationConfig
```

Citation fields already camelCase from c64 — do not regress.

## Suggested implementation order

### Phase A — Shared Zod

1. Edit every file under `packages/shared/src/schemas/` (and `streaming/`).
2. Fix `packages/shared/test/schemas.test.ts` and any fixtures.
3. `cd packages/shared && bun test`
4. Ensure OpenAPI generation still points at these schemas (project uses zod-to-openapi / Scalar).

### Phase B — Server

1. Grep `apps/server/src/features` for `notebook_id:`, `serialize`, snake response keys.
2. Update routers so request bodies / query / responses match shared camelCase schemas.
3. Update SSE done payloads (`apps/server/src/features/qa/**`, research streams).
4. Update export JSON (QA/Output) — **also camelCase** (including sources meta).
5. Fix tests: `apps/server/test/**`, `apps/server/tests/bdd/**`.
6. `cd apps/server && bun test`

### Phase C — DB JSON migrate

1. Add idempotent migration for embedded JSON:
   - `messages.citations`
   - `outputs.content` (nested citation objects)
2. Map snake citation keys → camel (reuse c64 field list).
3. Document: local wipe of `data/` is OK if migrate is skipped.

### Phase D — Web

1. Update all eden/fetch call sites to send camelCase.
2. Remove or gut snake→camel in:
   - `apps/web/src/features/workspace/shared/utils.ts` (`normalizeNotebook`, `normalizeSource`, …)
   - domain hooks (`useRefine`, `SlidesStudioDialog`, templates, prompt presets, …)
3. Delete/trim `apps/web/src/api/shared-types.ts` duplicates; prefer `@crystalith/shared` + Eden inference.
4. Replace workspace `Api*` interfaces with shared types or inferred eden types.
5. Fix vitest; keep SSE client but parse camel payloads.
6. `bun typecheck` from repo root; web tests.

### Phase E — Gates

1. `bun typecheck`
2. Prefer `just qa` if available and affordable
3. `llman sdd validate c65-api-wire-camelcase --strict --no-interactive` after checking all `tasks.md` boxes
4. **Stop** — do not `change archive` unless human says so (reviewer will review first)

## High-touch file inventory (start here)

### Shared (~17 schema modules)

- `packages/shared/src/schemas/common.ts`, `env.ts`, `i18n.ts`, `index.ts`
- `message.ts`, `session.ts`, `notebook.ts`, `source.ts`, `output.ts`, `qa.ts`, `refine.ts`
- `studio.ts`, `research.ts`, `task.ts`, `template.ts`, `model.ts`, `eval.ts`
- `streaming/qa-stream.ts`, `streaming/research-progress.ts`
- Tests: `packages/shared/test/schemas.test.ts`

### Server routers known to emit snake today

- `apps/server/src/features/notebooks/router.ts`
- `apps/server/src/features/messages/router.ts`
- `apps/server/src/features/sessions/router.ts`
- `apps/server/src/features/sources/router.ts`
- `apps/server/src/features/outputs/router.ts`
- `apps/server/src/features/qa/router.ts` (+ `handler.ts`, `retrieve-and-judge.ts`)
- `apps/server/src/features/refine/router.ts`
- `apps/server/src/features/studio/router.ts`
- `apps/server/src/features/research/router.ts`
- `apps/server/src/features/tasks/router.ts`
- `apps/server/src/features/templates/router.ts`
- `apps/server/src/features/prompt-presets/router.ts`
- `apps/server/src/features/source-connectors/router.ts` (+ `sync.ts`, `types.ts`)
- `apps/server/src/features/citations/**`
- `apps/server/src/features/workspace/router.ts` (if present)
- `apps/server/src/shared/errors.ts`

### Web normalize / dual-type hotspots

- `apps/web/src/api/eden.ts`, `shared-types.ts`, `stream.ts`, `setup.ts`
- `apps/web/src/features/workspace/shared/types.ts`, `utils.ts`, `outputPayload.ts`
- `domains/notebooks/useNotebooks.ts`, `sessions/useSessions.ts`, `messages/useChat.ts`
- `domains/sources/useSources.ts`, `SourcesPanelView.tsx`, `SourceConnectorsDialog.tsx`
- `domains/refine/useRefine.ts`, `studio/SlidesStudioDialog.tsx`, `studio/utils/slides.ts`
- `domains/templates/**`, `shared/hooks/usePromptPresets.ts`, `useOutputQueue.ts`, `useCommands.ts`
- Citation UI (`components/citations/**`) — already camelCase; regression-check only

## Definition of done

- [ ] No intentional snake_case keys in HTTP JSON contracts from shared Zod
- [ ] Server tests + web tests + typecheck green
- [ ] No API snake→camel normalize left
- [ ] `shared-types.ts` / `Api*` not acting as a second SSOT
- [ ] OpenAPI/Scalar shows camelCase
- [ ] `tasks.md` all `[x]`
- [ ] Short IMPLEMENTATION_NOTES.md in the change dir listing remaining risks (if any)

## Out of scope reminders

- Do not implement c13 distribution
- Do not rename Drizzle columns
- Do not “also refactor unrelated UI”
- Do not archive/merge without human + reviewer

## When finished

Reply with:

1. Summary of phases completed
2. Commands run + results
3. Path to `IMPLEMENTATION_NOTES.md` (create it)
4. Explicit list of anything skipped / blocked

Then stop for **reviewer agent** (not archive).
