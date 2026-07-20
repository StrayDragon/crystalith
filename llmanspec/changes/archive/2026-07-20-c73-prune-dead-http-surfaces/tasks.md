# Tasks — c73-prune-dead-http-surfaces

## Phase 1: Shared package cleanup

- [x] Remove `packages/shared/src/schemas/refine.ts` + barrel export
- [x] Remove `packages/shared/src/schemas/eval.ts` + barrel export
- [x] Remove `packages/shared/src/schemas/task.ts` + barrel export
- [x] Run `bun typecheck` to verify no import breakage

## Phase 2: Server — delete refine domain

- [x] Delete `apps/server/src/features/refine/router.ts`
- [x] Delete `apps/server/src/features/refine/format.ts`
- [x] Delete `apps/server/src/features/refine/retrieve.ts`
- [x] Unregister `refineRouter(taskQueue)` from `apps/server/src/server.ts`
- [x] Remove `import { refineRouter }` from server.ts

## Phase 3: Server — delete tasks domain + TaskQueue

- [x] Delete `apps/server/src/features/tasks/router.ts`
- [x] Delete `apps/server/src/features/tasks/worker.ts`
- [x] Unregister `tasksRouter(taskQueue)` from server.ts
- [x] Remove `createStageLimiters`, `runTask` imports from server.ts
- [x] Remove entire TaskQueue instantiation + worker dispatch loop from server.ts
- [x] Delete `apps/server/src/shared/queue.ts`
- [x] Remove `tasks` table from `apps/server/src/db/schema.ts`
- [x] Note: `shared/semaphore.ts` kept — still used by research module

## Phase 4: Server — delete eval domain

- [x] Delete `apps/server/src/features/eval/router.ts`
- [x] Delete `apps/server/src/features/eval/dataset.ts`
- [x] Delete `apps/server/src/features/eval/runner.ts`
- [x] Delete `apps/server/src/features/eval/metrics.ts`
- [x] Unregister `evalRouter` from server.ts
- [x] Remove `evalDatasets`, `evalItems`, `evalRuns`, `evalRunItems` tables from `apps/server/src/db/schema.ts`

## Phase 5: Server — delete strategies HTTP, keep registry

- [x] Delete `apps/server/src/rag/router.ts`
- [x] Unregister `strategiesRouter` from server.ts
- [x] KEEP `rag/registry.ts` and all strategy implementations; moved registration to registry.ts

## Phase 6: Server — delete duplicate registry routes

- [x] Remove `GET /outputs/types` route from `apps/server/src/features/outputs/router.ts`
- [x] Remove `import { listOutputTypes }` from outputs/router.ts (keep OUTPUT_META/FRONTEND_BUNDLES for workspace)
- [x] Remove `GET /qa/presets` route from `apps/server/src/features/qa/router.ts`
- [x] Remove `listPresets` from QA router import (keep resolvePreset, parsePromptDirective)
- [x] Remove `GET /v2/outputs/types` OpenAPI doc from outputs router

## Phase 7: Server — delete citations HTTP

- [x] Delete `apps/server/src/features/citations/router.ts`
- [x] Delete `apps/server/src/features/citations/context.ts` (resolveChunkContext only used by citations router)
- [x] Unregister `citationsRouter` from server.ts

## Phase 8: Server — update tests

- [x] Delete `apps/server/test/refine/` directory
- [x] Delete `apps/server/test/citations/` directory
- [x] Delete `apps/server/test/queue/semaphore.test.ts`
- [x] Update `apps/server/test/openapi-generation.test.ts` — remove citations import and path check
- [x] Update `apps/server/test/integration/notebook-isolation.test.ts` — remove outputs/types test
- [x] Update `apps/server/test/integration/pagination.test.ts` — remove tasks import and test
- [x] Update `apps/server/test/db.test.ts` — remove eval table checks
- [x] Update `packages/shared/test/schemas.test.ts` — remove eval schema tests

## Phase 9: Typecheck + QA

- [x] Run `bun typecheck` — fix any import errors
- [x] Run `just test` — fix server/shared unit tests (283 pass)
- [x] Run `just test-web` — fix frontend tests (134 pass)
- [x] Run `just check` — fix lint/format
- [x] Run `just qa` — full PR gate passes

## Phase 10: Spec archive

- [x] Run `llman sdd validate c73-prune-dead-http-surfaces --strict --no-interactive` (delta specs OK, only pending tasks shown)
- [x] If pass, run `llman sdd change archive c73-prune-dead-http-surfaces`
