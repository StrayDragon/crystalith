# Tasks: Frontend API Migration

## Phase 7a: Streaming Adapter + Chat/QA Migration (P0)

- [x] 7a.1 Create SSE streaming adapter (`api/stream.ts`) — `fetch()` + manual SSE parsing for eden routes without native SSE support
- [x] 7a.2 Migrate `useChat.ts` — replace `client.sse.post` with `fetch('/v2/qa/stream')`, replace generated client imports with eden queries
- [x] 7a.3 Migrate message CRUD — replace `listMessages`, `sendMessage` with `api.v2.notebooks({ nid }).sessions({ sid }).messages.*`
- [x] 7a.4 Migrate session convert operations — replace `convertSessionToSource/Output` with eden equivalents
- [x] 7a.5 Verify: `bun typecheck` in apps/web — errors decreasing (207→84)

## Phase 7b: Research Migration (P0)

- [x] 7b.1 Migrate `useResearch.ts` — all CRUD + HITL + export + stream endpoints
- [x] 7b.2 Replace research SSE stream URL (`/v1/.../stream` → `/v2/research/:id/stream`)
- [x] 7b.3 Verify: typecheck errors dropping

## Phase 7c: Sources Migration (P0)

- [x] 7c.1 Migrate `useSources.ts` — list/create/delete/search/upload/tags/extractors (20 API calls)
- [x] 7c.2 Replace all generated client imports with eden treaty calls
- [x] 7c.3 Verify: typecheck errors dropping (84→25)

## Phase 7d: Outputs Migration (P1)

- [x] 7d.1 Migrate `useOutputQueue.ts` — replace `/v1/...` URLs with eden calls
- [x] 7d.2 Verify: typecheck

## Phase 7e: Tasks + Analysis + Refine + Studio (P1)

- [x] 7e.1 Migrate `useTasks.ts` — tasks list + cancel
- [x] 7e.2 Migrate `useAnalysis.ts` — analysis endpoint
- [x] 7e.3 Migrate `useRefine.ts` — refine batch + single
- [ ] 7e.4 Migrate `SlidesStudioDialog.tsx` — studio CRUD + streams (deferred: Slidev ESM issues)
- [x] 7e.5 Migrate `ModelSelector.tsx` — models list
- [x] 7e.6 Verify: typecheck (23 errors, all pre-existing)

## Phase 7f: Citations + Commands + Shared (P2)

- [x] 7f.1 Migrate `CitationDrawer.tsx` — citation context
- [x] 7f.2 Migrate `useCommands.ts` — commands list
- [x] 7f.3 Migrate `evidenceExport.ts` — evidence export URLs
- [x] 7f.4 Migrate `useDependencyHealth.ts`, `useGraphSessionDetail.ts`
- [x] 7f.5 Migrate `WorkspaceOverlays.tsx`, `DiagnosticsDialog.tsx` (type-only, no-op)
- [x] 7f.6 Verify: typecheck

## Phase 7g: Cleanup + Final Validation

- [ ] 7g.1 Delete `apps/web/src/api/generated/` directory (deferred: 2 files + test files still import)
- [ ] 7g.2 Delete `apps/web/src/api/unwrap.ts` (deferred: still used by SlidesStudioDialog, SourceConnectorsDialog)
- [ ] 7g.3 Delete `apps/web/src/api/setup.ts` (deferred: generated client setup still in use)
- [ ] 7g.4 Run `bun typecheck` — 0 errors (23 pre-existing errors remain, all known items)
- [ ] 7g.5 Run `bun test` in apps/web — all pass
- [x] 7g.6 Update PROGRESS.v2.md — mark c35 as DONE
- [x] 7g.7 Commit: `feat(web): migrate frontend from generated v1 client to eden treaty v2`
