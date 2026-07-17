# Frontend ↔ Backend API Alignment Report

> Generated: 2026-07-17
> Scope: apps/web Eden `api.v2` vs apps/server `/v2` routes
> Trigger: upload missing `notebook_id` (fixed in cc69ef84)

## Summary

- **HIGH:** 3
- **MEDIUM:** 8
- **LOW:** 6
- **Coverage:** ~83 `api.v2` references across 18 production files / ~95 server route handlers scanned (19 feature routers + `rag/router.ts`, prefix `/v2`)

## Confirmed / Likely Bugs (HIGH)

### 1. Create notebook from template omits `template_id` query param

- **Server:** `POST /v2/notebooks?template_id=<id>` — reads `template_id` from **query** and applies template sessions/tags (`apps/server/src/features/notebooks/router.ts:136-158`)
- **Frontend:** `apps/web/src/features/workspace/domains/notebooks/useNotebooks.ts:198-200` — comment says query param is required, but call is:
  ```ts
  await api.v2.notebooks.post({ name: finalName });
  ```
  `templateId` argument is never passed.
- **Risk:** “从模板创建笔记本” UI (`WorkspaceLayout.tsx:905` → `createNotebookFromTemplate`) creates an empty notebook; template sessions/tags never applied.
- **Suggested fix:** `api.v2.notebooks.post({ name: finalName }, { query: { template_id: String(templateId) } })`

### 2. Research session delete is client-only (no API call)

- **Server:** `DELETE /v2/research/:id` (`apps/server/src/features/research/router.ts:366`)
- **Frontend:** `apps/web/src/features/workspace/domains/research/useResearch.ts:262-278` — `deleteSession` only filters local React state; comment admits API not wired:
  ```ts
  // v2 research delete via remove not directly exposed — use notebook-level removal
  setSessions((prev) => prev.filter((s) => s.id !== researchId));
  ```
  Called from `SourcesPanelView.tsx:640`.
- **Risk:** Deleted research reappears on refresh; orphaned DB rows; user believes delete succeeded.
- **Suggested fix:** `await api.v2.research({ id: researchId }).delete()` then update local state.

### 3. Research export UI selections ignored by server contract

- **Server:** `POST /v2/research/:id/export` — body uses only `export_type` (`source` | `note`); always exports full `finalReport` (`apps/server/src/features/research/router.ts:607-716`). No `include_report`, `include_results`, or per-reference URL list.
- **Frontend:** `apps/web/src/features/workspace/domains/research/ResearchExportDialog.tsx:127-138` — collects `selectedRefs` URLs but sends only booleans:
  ```ts
  .export.post({
    export_type: exportTarget,
    include_report: includeReport,
    include_results: selectedRefs.length > 0,
  } as any);
  ```
  Selected reference URLs are never transmitted.
- **Risk:** User can select/deselect report and individual references in the dialog, but export always includes the full report markdown; reference filtering has no effect.
- **Suggested fix:** Align contract — either extend server export body with `reference_urls: string[]` / `include_report: boolean`, or simplify FE UI to match current server behavior.

## Medium Issues

### M1. Non-streaming QA omits `source_ids` (streaming path is correct)

- **Server:** `POST /v2/qa` accepts `source_ids` for scoped retrieval (`apps/server/src/features/qa/router.ts:168-225`)
- **Frontend streaming:** `useChat.ts:249-250` passes `source_ids` when sources are selected.
- **Frontend non-streaming:** `useChat.ts:408-412` sends only `question`, `notebook_id`, `session_id` — no `source_ids`.
- **Risk:** If `enableStreaming` is ever `false`, selected-source chat scope is ignored. Production default is `true` (`WorkspaceLayout.tsx:79-84`), so latent unless streaming is disabled.
- **Suggested fix:** Mirror streaming body in non-streaming branch.

### M2. Output GET/DELETE omit optional `notebook_id` (c57 ownership bypass)

- **Server:** `GET/DELETE /v2/outputs/:id` — `requireOutputInNotebook` enforces notebook only when `notebook_id` query is present (`apps/server/src/features/outputs/router.ts:24-35, 266-276`)
- **Frontend omitting query:**
  - `useOutputQueue.ts:561` — `api.v2.outputs({ id: outputId }).delete()`
  - `useOutputQueue.ts:587` — `api.v2.outputs({ id: outputId }).get()`
- **Frontend including query (good):** abort cleanup `useOutputQueue.ts:396-398`, list `useOutputQueue.ts:150-152`
- **Risk:** Cross-notebook output access/deletion possible if output ID is known (weaker than sources c57 strictness).
- **Suggested fix:** Always pass `{ query: { notebook_id: String(activeNotebookId) } }` on get/delete.

### M3. Raw `fetch` output export omits `notebook_id`

- **Server:** `GET /v2/outputs/:id/export` uses same optional ownership check (`outputs/router.ts:282-285`)
- **Frontend:** `evidenceExport.ts:85-96` — `notebookId` is in the TS params type but **not** added to the URL query string.
- **Risk:** Same as M2 for markdown/json download links.
- **Suggested fix:** `query.set('notebook_id', String(params.notebookId))` on export URLs.

### M4. `ModelSelector` query key mismatch (`capability` vs `role`)

- **Server:** `GET /v2/models?role=chat|embed` (`apps/server/src/features/models/router.ts:38-44`)
- **Frontend:** `ModelSelector.tsx:59-60` — `{ query: capability ? { capability } : undefined }`
- **Risk:** Currently only used with `capability="chat"` (`StudioToolsGrid.tsx:416`, `SlidesStudioDialog.tsx:1300`), so filter is a no-op today. Adding an embedding picker would list all models.
- **Suggested fix:** Rename query key to `role` (map `embedding` → `embed` if needed).

### M5. Widespread `as any` on Eden treaty chains (sources domain)

- **Examples:** `useSources.ts` — upload (`266-267`), batch ops (`473-475`), tag assign (`636-637`), `from-url` (`721-723`), `re-embed` (`864-866`); `SourceDetailDialog.tsx:146`
- **Risk:** Same class of bug as upload `notebook_id` — TypeScript cannot flag missing query/body fields. Runtime-only failures.
- **Suggested fix:** Type Eden paths properly or add thin typed wrapper functions per route group.

### M6. Research `modify` endpoint has no frontend caller

- **Server:** `POST /v2/research/:id/modify` with `{ plan }` body (`research/router.ts:406-430`)
- **Frontend:** No `api.v2.research({ id }).modify.post(...)` call site; only `approve`, `skip`, `finish`, `cancel`, `resume`.
- **Risk:** HITL plan editing may be unimplemented in v2 UI (needs product verify).

### M7. Citations neighborhood context endpoint unused

- **Server:** `GET /v2/notebooks/:nid/citations/context?chunk_id=...` (`citations/router.ts:53-114`)
- **Frontend:** No Eden or `fetch` call found; `CitationContextResponse` only in `shared-types.ts`.
- **Risk:** Citation popover may lack neighbor-chunk evidence that v1 provided (needs UX verify).

### M8. Integration tests still mock `/v1/*` paths

- **Examples:** `useChat.test.tsx`, `useSources.test.tsx`, `useResearch.test.ts`, `useOutputQueue.test.tsx` — MSW handlers use `*/v1/notebooks/...`
- **Risk:** Tests pass while production uses `/v2`; regressions like missing `notebook_id` may not be caught (partially addressed in `useSources.test.tsx` for upload).
- **Suggested fix:** Migrate MSW handlers to `/v2` paths matching Eden routes.

## Low / Hygiene

### L1. Server routes with no frontend `api.v2` usage (may be intentional)

| Route                                                                            | Notes                                                             |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `GET /v2/refine/modes`, `POST /v2/refine`, `POST /v2/refine/batch`               | FE uses `POST /v2/outputs` via `useOutputQueue` instead           |
| `GET /v2/outputs/types`                                                          | Output types come from `GET /v2/workspace/tools`                  |
| `GET /v2/qa/presets`                                                             | Presets parsed from `/prompt:` directive client-side              |
| `GET /v2/tasks/:id`, `GET /v2/notebooks/:nid/tasks`, `POST /v2/tasks/:id/cancel` | No task polling in web app                                        |
| `GET /v2/eval/*`                                                                 | Eval harness server-only                                          |
| `GET /v2/strategies`, notebook strategy routes                                   | No FE caller                                                      |
| `GET /v2/models/:modelId`, `GET /v2/models/providers`                            | List endpoint sufficient                                          |
| `GET /v2/workspace/tools/:id/config`                                             | Tools returned inline from list                                   |
| `GET /v2/sources/:id`, `GET /v2/sources/parsers`                                 | List path used; single-source GET unused                          |
| `GET /v2/studio/slides/latest`                                                   | FE lists via `GET /v2/studio/slides?notebook_id=`                 |
| `GET /v2/studio/slides/:id/*/stream`                                             | FE uses non-SSE POST outline/markdown (`useOutputQueue.ts:77-97`) |
| `DELETE /v2/source-connector-bindings/:id`                                       | No unbind UI found                                                |

### L2. `evidenceExport.ts` stale comment

- Line 53: `// Note: v2 server doesn't have /qa/export yet` — endpoint exists at `GET /v2/qa/export` (`qa/router.ts:327`).

### L3. `notebook_id` passed as number vs string (inconsistent)

- Eden accepts both in practice, but mixed: `useSources.ts` uses numeric `notebook_id`; `useOutputQueue.ts` / `useResearch.ts` use `String(...)`. Prefer one convention for clarity.

### L4. `POST /v2/analysis` — no aligned frontend domain on disk

- Grep index may reference removed `domains/analysis/` files; current tree has no `useAnalysis.ts`. No live mismatch, but watch if analysis is reintroduced.

### L5. QA export accepts `notebookId` in FE helper but server derives it from session

- `exportQaMarkdownDownload` / `exportQaJsonDownload` (`evidenceExport.ts:42-72`) — `notebookId` param unused; server resolves via `session_id` (`qa/router.ts:367-369`). Harmless but confusing API surface.

### L6. Research list without `notebook_id` returns all notebooks’ sessions

- Server allows omitting filter (`research/router.ts:341-348`); FE always passes `notebook_id` (`useResearch.ts:183-184`). No bug when using FE; server should consider requiring filter.

## Already Fixed (reference)

- **Upload `notebook_id`:** `cc69ef84` — `useSources.ts:266-267` and dedup retry `293-296` now pass `{ query: { notebook_id: activeNotebookId } }` on `POST /v2/sources/upload`. Server requires it (`sources/router.ts:240-243`).

## `notebook_id` — FE upload / delete / patch table

| Operation                     | Method  | Path                                        | `notebook_id`               | File:line                        | Notes                |
| ----------------------------- | ------- | ------------------------------------------- | --------------------------- | -------------------------------- | -------------------- |
| Upload file                   | POST    | `/v2/sources/upload`                        | query ✅                    | `useSources.ts:266-267`          | Fixed                |
| Upload dedup retry            | POST    | `/v2/sources/upload`                        | query ✅ (+ `dedup_action`) | `useSources.ts:293-296`          | Fixed                |
| Delete single source          | DELETE  | `/v2/sources/:id`                           | query ✅                    | `useSources.ts:502-503`          |                      |
| Re-embed source               | POST    | `/v2/sources/:id/re-embed`                  | query ✅                    | `useSources.ts:864-866`          |                      |
| Get source chunks             | GET     | `/v2/sources/:id/chunks`                    | query ✅                    | `SourceDetailDialog.tsx:144-146` |                      |
| Batch delete sources          | POST    | `/v2/notebooks/:nid/sources/batch/delete`   | path `:nid` ✅              | `useSources.ts:473-475`          | notebook in path     |
| Batch re-embed                | POST    | `/v2/notebooks/:nid/sources/batch/re-embed` | path `:nid` ✅              | `useSources.ts:535-537`          |                      |
| From URL                      | POST    | `/v2/notebooks/:nid/sources/from-url`       | path `:nid` ✅              | `useSources.ts:721-723`          | dedup via query only |
| List outputs                  | GET     | `/v2/outputs`                               | query ✅                    | `useOutputQueue.ts:150-152`      |                      |
| Delete output (abort cleanup) | DELETE  | `/v2/outputs/:id`                           | query ✅                    | `useOutputQueue.ts:396-398`      |                      |
| Delete output (user)          | DELETE  | `/v2/outputs/:id`                           | query ❌                    | `useOutputQueue.ts:561`          | See M2               |
| Get output                    | GET     | `/v2/outputs/:id`                           | query ❌                    | `useOutputQueue.ts:587`          | See M2               |
| Export output (fetch)         | GET     | `/v2/outputs/:id/export`                    | query ❌                    | `evidenceExport.ts:85-96`        | See M3               |
| List slide drafts             | GET     | `/v2/studio/slides`                         | query ✅                    | `SlidesStudioDialog.tsx:415-416` |                      |
| List research                 | GET     | `/v2/research`                              | query ✅                    | `useResearch.ts:183-184`         |                      |
| Patch slide draft             | PATCH   | `/v2/studio/slides/:id`                     | body fields only            | `SlidesStudioDialog.tsx:627-629` | notebook in row      |
| Tag CRUD / assign             | various | `/v2/notebooks/:nid/sources/tags/...`       | path `:nid` ✅              | `useSources.ts`                  |                      |
| Patch extractors              | PATCH   | `/v2/notebooks/:nid/extractors`             | path `:nid` ✅              | `useSources.ts:818-820`          |                      |

## Method Notes

### Enumeration

1. **Server:** `rg '\.(get|post|put|patch|delete)\(' apps/server/src/features/**/router.ts` + `source-extras.router.ts` + `rag/router.ts`; confirmed `prefix: '/v2'` on each router; mounted in `apps/server/src/server.ts`.
2. **Frontend:** `rg 'api\.v2' apps/web/src` excluding `*.test.*` and `eden.ts` comments; plus `streamRequest('/v2/...')` and raw `fetch` in `evidenceExport.ts`.
3. **Query requirements:** `rg 'notebook_id' apps/server/src/features` cross-checked against FE `query:` / path params.

### Limitations

- Eden Treaty dynamic segments hidden behind `as any` (especially sources tags, `re-embed`, `from-url`, hyphenated routes) — static analysis incomplete.
- Some server routes use optional query enforcement (outputs) vs required (upload, outputs list, studio slides list).
- Test files still target `/v1` URLs; not counted as production call sites.
- Workspace index may list files absent on disk (e.g. `domains/analysis/`); on-disk scan is authoritative.

## Checklist for follow-up

- [ ] Fix `createNotebookFromTemplate` — pass `template_id` query on `POST /v2/notebooks`
- [ ] Wire `DELETE /v2/research/:id` in `useResearch.deleteSession`
- [ ] Align research export contract (server body vs `ResearchExportDialog` selections)
- [ ] Add `source_ids` to non-streaming `POST /v2/qa` in `useChat.ts`
- [ ] Pass `notebook_id` on output get/delete/export fetch calls
- [ ] Rename `ModelSelector` query `capability` → `role`
- [ ] Reduce `as any` on sources Eden chains; add regression tests for required query params
- [ ] Migrate MSW integration tests from `/v1/*` to `/v2/*`
- [ ] Verify whether `POST /v2/research/:id/modify` and `GET .../citations/context` need UI wiring
- [ ] Audit dead `/v2/refine` vs `/v2/outputs` split for intentional deprecation
