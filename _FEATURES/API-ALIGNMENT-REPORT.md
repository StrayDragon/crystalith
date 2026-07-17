# Frontend ↔ Backend API Alignment Report

> Generated: 2026-07-17
> Updated: 2026-07-17 (HIGH fixes applied)
> Scope: apps/web Eden `api.v2` vs apps/server `/v2` routes
> Trigger: upload missing `notebook_id` (fixed in cc69ef84)

## Summary

- **HIGH (open):** 0
- **HIGH (fixed this pass):** 3
- **MEDIUM (open):** 8
- **LOW:** 6
- **Coverage:** ~83 `api.v2` references across 18 production files / ~95 server route handlers scanned

## Fixed HIGH Issues

### ✅ 1. Create notebook from template omitted `template_id`

- **Was:** `POST /v2/notebooks` without `?template_id=` → empty notebook
- **Fix:** `useNotebooks.ts` now passes `{ query: { template_id: String(templateId) } }`
- **UI entry (easy to miss):** Header **笔记本** switcher → click **+** → bottom of create popover → **「从模板」** → pick a saved template
  (Also: **「管理模板」** / bookmark on active notebook to save current notebook as template.)

### ✅ 2. Research session delete was client-only

- **Was:** `deleteSession` only filtered React state; refresh resurrected rows
- **Fix:** `useResearch.ts` calls `DELETE /v2/research/:id` then updates local state

### ✅ 3. Research export UI selections ignored by server

- **Was:** Dialog offered report/reference multi-select but API only accepts `export_type` and always exports full `final_report`
- **Fix:** Simplified `ResearchExportDialog` to match server — choose **来源 / 笔记** only; export full final report. Removed fake filters.

## Medium Issues (still open)

### M1. Non-streaming QA omits `source_ids` (streaming path is correct)

- **Server:** `POST /v2/qa` accepts `source_ids`
- **Frontend streaming:** `useChat.ts` passes `source_ids`
- **Frontend non-streaming:** omits `source_ids`
- **Risk:** Latent unless streaming disabled (default is streaming on)

### M2. Output GET/DELETE omit optional `notebook_id` (c57 ownership bypass)

- `useOutputQueue.ts` user delete/get omit query; abort cleanup path includes it
- **Risk:** Weaker cross-notebook ownership check

### M3. Raw `fetch` output export omits `notebook_id`

- `evidenceExport.ts` — `notebookId` in params type but not added to URL query

### M4. `ModelSelector` query key mismatch (`capability` vs `role`)

- Server: `?role=chat|embed`
- FE: `?capability=...` (currently no-op for filter)

### M5. Widespread `as any` on Eden treaty chains (sources domain)

- Same class of bug as upload `notebook_id` — TS cannot catch missing query fields

### M6. Research `modify` endpoint has no frontend caller

- `POST /v2/research/:id/modify` — HITL plan edit may be unimplemented in UI

### M7. Citations neighborhood context endpoint unused

- `GET /v2/notebooks/:nid/citations/context` — no FE caller after CitationDrawer removal

### M8. Integration tests still mock `/v1/*` paths

- MSW handlers lag production `/v2`; regressions like missing query params less likely caught

## Low / Hygiene

### L1. Server routes with no frontend `api.v2` usage (may be intentional)

| Route                                                              | Notes                                           |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| `GET /v2/refine/modes`, `POST /v2/refine`, `POST /v2/refine/batch` | FE uses `POST /v2/outputs` via `useOutputQueue` |
| `GET /v2/outputs/types`                                            | Types from `GET /v2/workspace/tools`            |
| `GET /v2/qa/presets`                                               | Client-side `/prompt:` parsing                  |
| `GET /v2/tasks/*`                                                  | No task polling UI                              |
| `GET /v2/eval/*`                                                   | API-only harness                                |
| `GET /v2/strategies`, notebook strategy routes                     | No FE caller                                    |
| Studio SSE stream routes                                           | FE uses non-SSE POST                            |
| `DELETE /v2/source-connector-bindings/:id`                         | No unbind UI found                              |

### L2–L6

- Stale comments in `evidenceExport.ts`
- Mixed `notebook_id` number vs string
- Removed analysis domain vs leftover server routes
- QA export unused `notebookId` helper param
- Research list allows omitting `notebook_id` on server (FE always passes it)

## Already Fixed (earlier)

- **Upload `notebook_id`:** `cc69ef84` — `POST /v2/sources/upload` (+ dedup retry) includes `notebook_id`

## `notebook_id` — FE upload / delete / patch table

| Operation                                 | Method     | Path                       | `notebook_id`              | File                       | Notes        |
| ----------------------------------------- | ---------- | -------------------------- | -------------------------- | -------------------------- | ------------ |
| Upload file                               | POST       | `/v2/sources/upload`       | query ✅                   | `useSources.ts`            | Fixed        |
| Upload dedup retry                        | POST       | `/v2/sources/upload`       | query ✅                   | `useSources.ts`            | Fixed        |
| Delete source                             | DELETE     | `/v2/sources/:id`          | query ✅                   | `useSources.ts`            |              |
| Re-embed source                           | POST       | `/v2/sources/:id/re-embed` | query ✅                   | `useSources.ts`            |              |
| Get chunks                                | GET        | `/v2/sources/:id/chunks`   | query ✅                   | `SourceDetailDialog.tsx`   |              |
| Batch delete / re-embed / from-url / tags | various    | `/v2/notebooks/:nid/...`   | path ✅                    | `useSources.ts`            |              |
| List outputs                              | GET        | `/v2/outputs`              | query ✅                   | `useOutputQueue.ts`        |              |
| Delete output (abort)                     | DELETE     | `/v2/outputs/:id`          | query ✅                   | `useOutputQueue.ts`        |              |
| Delete/get output (user)                  | DELETE/GET | `/v2/outputs/:id`          | query ❌                   | `useOutputQueue.ts`        | M2           |
| Export output                             | GET        | `/v2/outputs/:id/export`   | query ❌                   | `evidenceExport.ts`        | M3           |
| Create notebook from template             | POST       | `/v2/notebooks`            | `template_id` query ✅     | `useNotebooks.ts`          | Fixed HIGH-1 |
| Delete research                           | DELETE     | `/v2/research/:id`         | path id ✅                 | `useResearch.ts`           | Fixed HIGH-2 |
| Export research                           | POST       | `/v2/research/:id/export`  | body `export_type` only ✅ | `ResearchExportDialog.tsx` | Fixed HIGH-3 |

## Method Notes

1. Server: scanned feature `router.ts` files under `/v2` prefix
2. Frontend: `api.v2` + raw `fetch`/`streamRequest`
3. Limitations: heavy `as any` hides missing query/body at compile time; optional vs required `notebook_id` differs by route

## Checklist for follow-up

- [x] Fix `createNotebookFromTemplate` — pass `template_id`
- [x] Wire `DELETE /v2/research/:id`
- [x] Align research export UI with server `export_type` contract
- [ ] Add `source_ids` to non-streaming `POST /v2/qa`
- [ ] Pass `notebook_id` on output get/delete/export
- [ ] Rename `ModelSelector` query `capability` → `role`
- [ ] Reduce `as any` on sources Eden chains; regression tests for required query params
- [ ] Migrate MSW tests from `/v1/*` to `/v2/*`
- [ ] Verify `POST /v2/research/:id/modify` and citations context need UI
- [ ] Audit dead `/v2/refine` vs `/v2/outputs`
