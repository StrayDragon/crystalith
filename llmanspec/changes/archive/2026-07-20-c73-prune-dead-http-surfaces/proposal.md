---
depends_on: []
---

## Why

Six HTTP surface groups have **no user-facing feature** — only unit/BDD/OpenAPI specs and vision docs. Per product policy (2026-07-20, `_FEATURES/` marks them as `dead-candidate`), they must be removed to shrink API surface, reduce maintenance burden, and simplify OpenAPI documentation.

These surfaces were built during the v1→v2 migration as parity targets, but the FE never implemented the corresponding UI. Keeping them alive adds dead code paths, wastes test time, and confuses API consumers.

## What Changes

1. **Delete entire refine HTTP** — `GET /v2/refine/modes`, `POST /v2/refine`, `POST /v2/refine/batch`, `POST /v2/notebooks/:nid/refine*`. Keep `refine/format.ts` and `refine/retrieve.ts` only as internal helpers if still used; remove otherwise. Remove `packages/shared/src/schemas/refine.ts` schemas + exports.

2. **Delete entire tasks HTTP** — `GET /v2/tasks/:id`, `GET /v2/notebooks/:nid/tasks`, `POST /v2/tasks/:id/cancel`. After refine deletion: `TaskQueue` has no remaining enqueue callers (refine was the only producer; `document_parse` type has no enqueue caller). Remove `TaskQueue`, `worker.ts`, `shared/queue.ts`, `tasks` router. Remove `packages/shared/src/schemas/task.ts` schemas + exports.

3. **Delete entire eval harness HTTP + feature** — All `/v2/eval/*` routes, `eval/dataset.ts`, `eval/runner.ts`, `eval/metrics.ts`, `eval/router.ts`. Remove `packages/shared/src/schemas/eval.ts` schemas + exports. Remove `evalDatasets`, `evalItems`, `evalRuns`, `evalRunItems` from DB schema.

4. **Delete strategies HTTP only** — `GET /v2/strategies`, `GET/POST /v2/notebooks/:nid/strategies`. Remove `rag/router.ts` mount. **Keep** `ragRegistry`, strategy implementations (QA/outputs/studio still use them).

5. **Delete duplicate registry routes** — `GET /v2/outputs/types` (FE uses `/v2/workspace/tools`; keep `OUTPUT_META`/`FRONTEND_BUNDLES` for workspace router). `GET /v2/qa/presets` (keep `qa/presets.ts` — `listPresets`/`resolvePreset`/`parsePromptDirective` used by QA + commands).

6. **Delete citations HTTP** — `GET /v2/notebooks/:nid/citations/context`, `GET /v2/citations/:messageId`. Keep `citations/context.ts` `resolveChunkContext` if imported elsewhere; remove otherwise. Remove `citations/router.ts` mount.

7. **Shrink specs**: Remove or orphan MUST/SHALL that mandate deleted surfaces from `structural-refinement-for-generated-results`, `evidence-review-workflow`, `quality-and-regression`, `background-jobs-and-task-runtime`, `workspace-api-contract`, `generation-core`.

## Capabilities Affected

- `structural-refinement-for-generated-results` — removed refine HTTP requirements; kept structural refinement concept for future use.
- `evidence-review-workflow` — removed citations context HTTP requirements; kept low-similarity evidence contract.
- `quality-and-regression` — removed r11 eval harness requirement.
- `background-jobs-and-task-runtime` — removed task HTTP interface requirements (r156, r222); kept lifecycle/progress/cancel semantics.
- `workspace-api-contract` — removed `process-registries-remain-global-flat` references to deleted registry routes; removed refine from nested-path clauses.
- `generation-core` — removed r227 refine contract.

## Impact

- BREAKING: These HTTP routes will 404. No FE consumer exists, so no user-facing breakage.
- OpenAPI spec shrinks ~30%.
- ~1500 lines of server code removed.
- ~800 lines of test code removed/updated.
- `TaskQueue` removed entirely (no remaining producers after refine deletion).
- `eval` DB tables (`eval_datasets`, `eval_items`, `eval_runs`, `eval_run_items`) removed from schema (no data loss — no production data exists).
- `tasks` DB table kept in schema but becomes unused (no enqueue callers); removed from schema.
