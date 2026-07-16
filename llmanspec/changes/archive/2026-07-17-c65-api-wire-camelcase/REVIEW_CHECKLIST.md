# c65 Review Checklist (for reviewer agent)

Use after an implementer finishes `c65-api-wire-camelcase`. **You review; human decides archive.**

## Inputs

- `proposal.md`, `design.md`, `tasks.md`, `IMPLEMENTATION_PROMPT.md`, `IMPLEMENTATION_NOTES.md` (if present)
- `llman sdd validate c65-api-wire-camelcase --strict --no-interactive`
- `git diff` / `git log` since change start
- Live smoke (optional): `POST /v2/qa` citation + a sources list payload

## Must verify

### Contract

- [ ] Shared Zod API fields are camelCase (spot-check message/session/source/qa/refine/studio)
- [ ] No dual-accept of snake+camel as formal contract
- [ ] Citation still camelCase (c64 preserved)
- [ ] SSE **event names** unchanged; **data** camelCase
- [ ] OpenAPI/Scalar reflects camelCase (spot-check one schema)

### Server

- [ ] No remaining `serialize*` emitting `notebook_id` / `created_at` style keys for API JSON
- [ ] Export JSON camelCase (including sources meta)
- [ ] Error envelope uses camelCase (`errorCode`, `retryAfter`, …) per shared schema
- [ ] Server tests updated; no mass skips hiding failures

### Web / Eden

- [ ] Call sites send camelCase
- [ ] No snake→camel API `normalize*` maps left
- [ ] `shared-types.ts` / `Api*` not a parallel SSOT
- [ ] Eden still used; no hey-api codegen revived
- [ ] typecheck green

### Persistence

- [ ] Migration for embedded JSON exists and is idempotent **or** documented wipe path
- [ ] Old DB with snake citations either migrated or clearly broken-by-design with wipe note

### Non-goals not violated

- [ ] DB columns not renamed
- [ ] Tauri/c13 not casually rewritten
- [ ] No silent snake compat layer

## Severity rubric

| Level      | Example                                                                    |
| ---------- | -------------------------------------------------------------------------- |
| CRITICAL   | Wire still snake on a core path; typecheck fails; dual SSOT                |
| WARNING    | One domain missed; export still snake; migrate missing but wipe documented |
| SUGGESTION | Comment drift; extra cleanup                                               |

## Output

Write a short review report:

1. Verdict: **APPROVE** / **REQUEST CHANGES**
2. Findings by severity with file paths
3. Whether `llman sdd change archive c65-api-wire-camelcase` is safe to run

Do **not** archive unless the human explicitly asks after APPROVE.
