# Frontend ↔ Backend API Alignment Report

> Generated: 2026-07-17
> Updated: 2026-07-20 (re-audit; notebook nesting; dead-surface policy; tasks/eval clarified vs code)
> Scope: apps/web Eden `api.v2` vs apps/server `/v2` routes
> Trigger: upload missing `notebook_id` (fixed in cc69ef84)

## Summary

- **HIGH (open):** 0
- **HIGH (fixed earlier):** 3
- **MEDIUM (open):** 4 — M4, M5, M6, M7（M7 = dead-candidate 待删码）
- **MEDIUM (resolved since original report):** 4 — M1, M2, M3, M8
- **Dead HTTP（文档已标 dead-candidate，代码仍在）：** refine*、tasks*、eval*、strategies HTTP、outputs/types、qa/presets、citations/context
- **Live gaps（不删）：** connector unbind UI；research modify 假勾选（M6）
- **Truth rule:** 以当前代码为准；`_FEATURES` NOTE 可领先于删码

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

## Medium — resolved (2026-07-20 re-audit)

### ✅ M1. Non-streaming QA omits `source_ids`

- **Was:** streaming passed `source_ids`; non-streaming omitted
- **Now:** `useChat.ts` both paths set `sourceIds` when sources are selected; covered by `useChat.test.tsx`

### ✅ M2. Output GET/DELETE omit optional `notebook_id`

- **Was:** flat `/v2/outputs/:id` without ownership query
- **Now:** `useOutputQueue.ts` uses nested `/v2/notebooks/:nid/outputs/:id` for get/delete

### ✅ M3. Raw `fetch` output export omits `notebook_id`

- **Was:** `evidenceExport.ts` typed `notebookId` but did not put it on the URL
- **Now:** exports go to `/v2/notebooks/:nid/outputs/:id/export` (and QA export similarly notebook-scoped)

### ✅ M8. Integration tests still mock `/v1/*` paths

- **Was:** MSW lagged on `/v1`
- **Now:** web Vitest/MSW handlers use `/v2/*` only (no `/v1/` matches under `apps/web`)

## Medium Issues (still open)

### M4. `ModelSelector` query key mismatch (`capability` vs `role`)

- Server filters on `query.role` (`ModelListQuerySchema`); `capability` is accepted and **ignored** (schema comment: legacy)
- FE `ModelSelector.tsx` still sends `{ capability: 'chat' | 'embedding' }`
- **Risk:** role filter is a no-op; UI always gets full model list (client may still pick defaults by capability)

### M5. Widespread `as any` on Eden treaty chains (sources domain)

- `useSources.ts` still has ~28 `as any` casts on Eden calls
- Same class of bug as original upload `notebook_id` — TS cannot catch missing query/body fields

### M6. Research `modify` unused; UI query selection is cosmetic

- Server: `POST /v2/notebooks/:nid/research/:id/modify` (body `plan`) still exists
- FE: no `.modify` caller; HITL uses `approve` / `skip` / `finish` / `cancel`
- **Worse than original note:** `ResearchDetailPanel` lets the user check/uncheck plan queries and labels the primary CTA「执行选中的 N 个搜索」, but `handleApprove` only calls `onApprove()` → `approve.post()` and **does not send the selection** (nor call `modify`)
- **Follow-up:** wire selection → `modify` with filtered plan, or remove fake checkboxes and always approve full plan

### M7. Citations neighborhood context — dead product surface

- `GET /v2/notebooks/:nid/citations/context` — no FE caller (CitationDrawer / evidence UI gone; Wave E already dropped review-UI vision)
- Still has server unit tests + BDD + `evidence-review-workflow` MUST clauses
- **Policy (2026-07-20):** no user feature → treat as dead; candidate for removal (code + shrink/orphan specs). Truth = current code, not legacy docs.

## Low / Hygiene + dead-surface audit (code-first, 2026-07-20)

**Policy:** If an HTTP surface has no user feature (only unit/BDD/OpenAPI/vision specs), it is **dead product** and may be removed. Keep internal modules that live paths still call. Docs below supersede older MATRIX/SERVER “Partial / useOutputQueue” claims where they conflict with code.

| Route                                                              | Notes (2026-07-20)                                  |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| `GET /v2/refine/modes`, `POST /v2/refine`, `POST /v2/refine/batch` | **dead-candidate** — FE Studio 走 outputs           |
| `GET /v2/outputs/types`                                            | **dead-candidate** — FE 用 `workspace/tools`        |
| `GET /v2/qa/presets`                                               | **dead-candidate** — FE 用 commands + `/prompt:`    |
| `/v2/tasks*`                                                       | **dead-candidate** — 无 FE；非创建 CRUD             |
| `/v2/eval/*`                                                       | **dead-candidate** — 无 UI/CI/CLI                   |
| `GET/POST /v2/strategies*`                                         | **dead-candidate** HTTP — 保留 `ragRegistry`        |
| Studio SSE stream routes                                           | **Live** — `consumeSlidesStageStream` GET SSE (c70) |
| `DELETE /v2/source-connector-bindings/:id`                         | **Live gap** — 补解绑 UI，不删 API                  |

### `/v2/tasks*` — dead observe/cancel surface (removal candidate)

- **Routes:** `GET /v2/tasks/:id`, `GET /v2/notebooks/:nid/tasks`, `POST /v2/tasks/:id/cancel` — **no** HTTP create. Rows only via in-process `TaskQueue.enqueue`.
- **Not** Studio output queue: `useOutputQueue` is client-local + `POST .../outputs` / slides SSE — **never** calls `/v2/tasks*`.
- **Producers today:** only `refine` enqueues. `document_parse` exists in worker/schema with **no enqueue caller**. Research/ingestion do not use this queue.
- **Sync pattern:** refine does `enqueue` + `waitForCompletion` in the same request — even refine clients need not poll.
- **Product decision (2026-07-20):** no shipped consumer → **dead; removal candidate** (HTTP + revisit in-process queue when refining domain). Specs: `background-jobs-and-task-runtime` is vision-only vs current code.

### `/v2/eval/*` — dead harness (removal candidate)

- **What:** Golden Dataset CRUD + `POST /eval/runs` (retrieve × strategy → generate → LLM-as-Judge → metrics). Code under `features/eval/*` + `schemas/eval.ts`.
- **Reality:** no UI; not in `just qa`; no `bun run eval` CLI despite router comment; only HTTP/`runEval` import.
- **Product decision (2026-07-20):** no user feature → **dead; removal candidate** (shrink `quality-and-regression` r11 when deleting).

### L2–L6 (historical; partly superseded by notebook nesting)

- Stale comments / mixed id typing — lower priority after path nesting
- Flat research/output aliases may still accept optional `notebook_id` query; canonical FE paths are nested
- Dead analysis-domain leftovers — audit with L1 if cleaning routes

## Already Fixed (earlier)

- **Upload `notebook_id`:** `cc69ef84` — `POST /v2/sources/upload` (+ dedup retry) includes `notebook_id`

## Ownership / nesting — FE table (post notebook-scope migration)

| Operation                     | Method     | Path (canonical)                           | Nesting                | File                       | Notes        |
| ----------------------------- | ---------- | ------------------------------------------ | ---------------------- | -------------------------- | ------------ |
| Upload file                   | POST       | `/v2/notebooks/:nid/sources/upload`        | path ✅                | `useSources.ts`            |              |
| Delete source                 | DELETE     | `/v2/notebooks/:nid/sources/:sid`          | path ✅                | `useSources.ts`            |              |
| Re-embed source               | POST       | `/v2/notebooks/:nid/sources/:sid/re-embed` | path ✅                | `useSources.ts`            |              |
| Get chunks                    | GET        | `/v2/notebooks/:nid/sources/:sid/chunks`   | path ✅                | `SourceDetailDialog.tsx`   |              |
| Batch sources / tags          | various    | `/v2/notebooks/:nid/...`                   | path ✅                | `useSources.ts`            |              |
| List / get / delete outputs   | GET/DELETE | `/v2/notebooks/:nid/outputs` / `.../:id`   | path ✅                | `useOutputQueue.ts`        | was M2       |
| Export output                 | GET        | `/v2/notebooks/:nid/outputs/:id/export`    | path ✅                | `evidenceExport.ts`        | was M3       |
| QA export                     | GET        | `/v2/notebooks/:nid/qa/export`             | path ✅                | `evidenceExport.ts`        |              |
| Create notebook from template | POST       | `/v2/notebooks`                            | `template_id` query ✅ | `useNotebooks.ts`          | Fixed HIGH-1 |
| Delete research               | DELETE     | `/v2/notebooks/:nid/research/:id`          | path ✅                | `useResearch.ts`           | Fixed HIGH-2 |
| Export research               | POST       | `/v2/notebooks/:nid/research/:id/export`   | body ✅                | `ResearchExportDialog.tsx` | Fixed HIGH-3 |

## Method Notes

1. Server: feature `router.ts` under `/v2` (+ nested `/notebooks/:nid/...` canonicals)
2. Frontend: `api.v2` + raw `fetch`/`streamRequest`
3. Limitations: sources-domain `as any` still hides missing fields; prefer nested routes over flat `?notebook_id=` aliases

## Checklist for follow-up

- [x] Fix `createNotebookFromTemplate` — pass `template_id`
- [x] Wire `DELETE /v2/research/:id`
- [x] Align research export UI with server `export_type` contract
- [x] Add `sourceIds` to non-streaming `POST .../qa` (M1)
- [x] Pass notebook ownership on output get/delete/export via nested paths (M2/M3)
- [x] Migrate MSW tests from `/v1/*` to `/v2/*` (M8)
- [ ] Rename `ModelSelector` query `capability` → `role` (M4)
- [ ] Reduce `as any` on sources Eden chains; regression tests for required fields (M5)
- [ ] Wire research plan query selection → `POST .../modify`, or remove cosmetic checkboxes (M6)
- [ ] Remove dead HTTP (code-first batch): M7 citations/context; `outputs/types`; `qa/presets` route; `strategies` HTTP; `/v2/tasks*`; `/v2/eval/*`; whole `/v2/refine*` (+ orphan `document_parse` worker arm / TaskQueue if unused)
- [ ] Add connector binding unbind UI (`DELETE .../bindings`) — live feature gap, not dead API
- [ ] Shrink/orphan specs tied to removed surfaces (`evidence-review-workflow`, `background-jobs-and-task-runtime`, `quality-and-regression` r11, `structural-refinement`, registry clauses in `workspace-api-contract`) when deleting
- [ ] Fix M4/M5/M6 product bugs separately (ModelSelector role; sources `as any`; research modify vs cosmetic checkboxes)
