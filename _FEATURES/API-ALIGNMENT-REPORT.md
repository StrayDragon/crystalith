# Frontend ↔ Backend API Alignment Report

> Generated: 2026-07-17
> Updated: 2026-07-20 (c73 prune dead HTTP + follow-up r77 / orphan schemas; `just qa` green)
> Scope: apps/web Eden `api.v2` vs apps/server `/v2` routes
> Truth: **current code**

## Summary

- **HIGH (open):** 0
- **MEDIUM (open):** 3 — M4, M5, M6（M7 citations HTTP **removed in c73**）
- **MEDIUM (resolved earlier):** M1, M2, M3, M8
- **Removed (c73):** refine*、tasks* + TaskQueue、eval*、strategies HTTP、`outputs/types`、`qa/presets`、citations HTTP
- **Live gaps:** connector unbind UI；research modify 假勾选（M6）

## Fixed HIGH (earlier)

1. Create notebook from template — `template_id`
2. Research delete wired to server
3. Research export UI aligned with `export_type`

## Medium — resolved

- **M1–M3, M8:** sourceIds / notebook nesting / MSW `/v2`（见历史）
- **M7:** citations HTTP removed in c73（无 FE）

## Medium — still open

### M4. `ModelSelector` `capability` vs server `role`

- FE still sends `{ capability }`; server filters `query.role`（`capability` legacy ignored）

### M5. Sources Eden `as any`

- `useSources.ts` still heavy casts — TS cannot catch missing fields

### M6. Research `modify` unused; query checkboxes cosmetic

- UI selection ignored; CTA only `approve.post()`

## Removed surfaces (c73) — do not reintroduce without product+SDD

| Surface                  | Kept internals                    |
| ------------------------ | --------------------------------- |
| `/v2/refine*`            | —；Studio 用 outputs              |
| `/v2/tasks*` + TaskQueue | —；`semaphore` 仍给 research      |
| `/v2/eval/*`             | —                                 |
| `/v2/strategies*` HTTP   | `ragRegistry` + strategies        |
| `GET /outputs/types`     | `OUTPUT_META` via workspace/tools |
| `GET /qa/presets`        | `qa/presets.ts` + commands        |
| citations HTTP           | citations in QA/messages payloads |

## Checklist

- [x] HIGH template / research delete / research export
- [x] M1–M3, M8
- [x] c73 dead HTTP prune + archive
- [x] Follow-up: workspace-api-contract r77 + orphan wire schemas
- [ ] M4 ModelSelector `capability` → `role`
- [ ] M5 reduce sources `as any`
- [ ] M6 research modify vs cosmetic checkboxes
- [ ] Connector binding unbind UI
- [ ] Optional: shrink orphan-vision specs (`background-jobs-*`, structural local-refine MUST)
