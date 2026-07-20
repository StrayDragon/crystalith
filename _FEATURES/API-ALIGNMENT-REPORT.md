# Frontend ↔ Backend API Alignment Report

> Generated: 2026-07-17
> Updated: 2026-07-20 (product gaps M4–M6 + connector unbind UI; prior: c73 prune)
> Scope: apps/web Eden `api.v2` vs apps/server `/v2` routes
> Truth: **current code**

## Summary

- **HIGH (open):** 0
- **MEDIUM (open):** 0
- **MEDIUM (resolved):** M1–M8
- **Removed (c73):** refine*、tasks* + TaskQueue、eval*、strategies HTTP、`outputs/types`、`qa/presets`、citations HTTP
- **Product gaps closed:** ModelSelector `role`；`useSources` 无 `as any`；research modify 接线；connector unbind UI

## Fixed HIGH (earlier)

1. Create notebook from template — `template_id`
2. Research delete wired to server
3. Research export UI aligned with `export_type`

## Medium — resolved

- **M1–M3, M8:** sourceIds / notebook nesting / MSW `/v2`
- **M4:** `ModelSelector` prop/query `role`（`ModelRole`；embed 默认读 `defaults.embedding`）；legacy `capability` query 已从 schema 移除
- **M5:** `useSources.ts` 去掉全部 `as any`（剩余窄断言仅因部分 route 未挂 response schema）
- **M6:** 勾选子集 → `POST .../research/:id/modify`；全选 → `approve`；server `loadLatestUserInput` 取最新 HITL
- **M7:** citations HTTP removed in c73（无 FE）
- **Unbind UI:** `SourceConnectorsDialog` → `DELETE /v2/source-connector-bindings/:id`

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
- [x] M4 ModelSelector `capability` → `role`
- [x] M5 reduce sources `as any`
- [x] M6 research modify vs cosmetic checkboxes
- [x] Connector binding unbind UI
- [x] Optional: shrink orphan-vision specs (`background-jobs-*` retired; structural local-refine MUST removed, research reqs kept)
