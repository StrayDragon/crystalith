# Design — c73-prune-dead-http-surfaces

## Design Decisions

### DD1: Remove entire refine domain (code + shared schemas)

- `refine/format.ts` and `refine/retrieve.ts` are only used by `refine/router.ts` and `tasks/worker.ts` (refine handler). Both are deleted along with their callers.
- `packages/shared/src/schemas/refine.ts` has no remaining consumers after HTTP removal.
- The `useRefine.ts` frontend hook uses **outputs** (not refine HTTP), so no frontend change needed.

### DD2: Remove entire tasks domain after refine

- `TaskQueue.enqueue` is only called by `refineRouter`. After refine HTTP deletion, no code calls enqueue.
- `document_parse` task type exists in the schema but has **no enqueue caller** — it's orphan code.
- Remove `TaskQueue` class, `worker.ts`, `shared/queue.ts`, `shared/semaphore.ts` (only used by queue), and the `tasks` DB table.
- This is pure dead code removal: no runtime path reaches task enqueue.

### DD3: Remove eval harness completely

- `eval/router.ts`, `dataset.ts`, `runner.ts`, `metrics.ts` — no FE consumer, no CLI (`bun run eval` is a lie in comments).
- Remove `evalDatasets`, `evalItems`, `evalRuns`, `evalRunItems` from DB schema.
- `packages/shared/src/schemas/eval.ts` has no remaining consumers.

### DD4: Remove strategies HTTP, keep runtime registry

- `rag/router.ts` registers strategies + exposes HTTP listing/config endpoints. No FE uses them.
- `ragRegistry`, strategy implementations (`EmbedStrategy`, `HybridStrategy`, `KeywordStrategy`, `PageIndexStrategy`) are used by QA, outputs, studio pipelines — keep all.
- The `import` and `register` calls that are currently in `rag/router.ts` move to the first caller, or stay in an init module.

### DD5: Remove duplicate registry routes

- `GET /v2/outputs/types` — FE uses `GET /v2/workspace/tools` instead. Keep `OUTPUT_META` / `FRONTEND_BUNDLES` / `listOutputTypes` in `generator.ts` since workspace router imports them.
- `GET /v2/qa/presets` — delete route, keep `presets.ts` (imported by QA handler and commands).

### DD6: Remove citations HTTP

- `GET /v2/notebooks/:nid/citations/context` — no FE consumer.
- `GET /v2/citations/:messageId` — citations ride QA/messages payloads, no FE uses this dedicated endpoint.
- `citations/context.ts` (`resolveChunkContext`) — only used by citations router. Delete entire citations domain.
- `hydrateCitations` in shared/citations.ts — used by QA/retrieve pipeline, not by citations router. Leave it.

### DD7: No frontend changes needed

- The task explicitly says: keep `useRefine.ts` (it uses outputs, not refine HTTP).
- No FE component references these deleted routes.

### DD8: OpenAPI generation test update

- `apps/server/test/openapi-generation.test.ts` imports `citations/router.ts` and checks `/v2/notebooks/:nid/citations/context`. Update to not reference deleted routers.
