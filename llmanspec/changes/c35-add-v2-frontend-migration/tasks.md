# Tasks: Frontend API Migration

## Phase 7a: Streaming Adapter + Chat/QA Migration (P0)

- [ ] 7a.1 Create SSE streaming adapter (`api/stream.ts`) — `fetch()` + manual SSE parsing for eden routes without native SSE support
- [ ] 7a.2 Migrate `useChat.ts` — replace `client.sse.post` with `fetch('/v2/qa/stream')`, replace generated client imports with eden queries
- [ ] 7a.3 Migrate message CRUD — replace `listMessages`, `sendMessage` with `api.v2.notebooks({ nid }).sessions({ sid }).messages.*`
- [ ] 7a.4 Migrate session convert operations — replace `convertSessionToSource/Output` with eden equivalents
- [ ] 7a.5 Verify: `bun typecheck` in apps/web — errors decreasing

## Phase 7b: Research Migration (P0)

- [ ] 7b.1 Migrate `useResearch.ts` — all CRUD + HITL + export + stream endpoints
- [ ] 7b.2 Replace research SSE stream URL (`/v1/.../stream` → `/v2/research/:id/stream`)
- [ ] 7b.3 Verify: typecheck errors dropping

## Phase 7c: Sources Migration (P0)

- [ ] 7c.1 Migrate `useSources.ts` — list/create/delete/search/upload/tags/extractors
- [ ] 7c.2 Replace all generated client imports with eden treaty calls
- [ ] 7c.3 Verify: typecheck errors dropping

## Phase 7d: Outputs Migration (P1)

- [ ] 7d.1 Migrate `useOutputQueue.ts` — replace `/v1/...` URLs with eden calls
- [ ] 7d.2 Verify: typecheck

## Phase 7e: Tasks + Analysis + Refine + Studio (P1)

- [ ] 7e.1 Migrate `useTasks.ts` — tasks list + cancel
- [ ] 7e.2 Migrate `useAnalysis.ts` — analysis endpoint
- [ ] 7e.3 Migrate `useRefine.ts` — refine batch + single
- [ ] 7e.4 Migrate `SlidesStudioDialog.tsx` — studio CRUD + streams
- [ ] 7e.5 Migrate `ModelSelector.tsx` — models list
- [ ] 7e.6 Verify: typecheck

## Phase 7f: Citations + Commands + Shared (P2)

- [ ] 7f.1 Migrate `CitationDrawer.tsx` — citation context
- [ ] 7f.2 Migrate `useCommands.ts` — commands list
- [ ] 7f.3 Migrate `evidenceExport.ts` — evidence export URLs
- [ ] 7f.4 Migrate `useDependencyHealth.ts`, `useGraphSessionDetail.ts`
- [ ] 7f.5 Migrate `WorkspaceOverlays.tsx`, `DiagnosticsDialog.tsx`
- [ ] 7f.6 Verify: typecheck

## Phase 7g: Cleanup + Final Validation

- [ ] 7g.1 Delete `apps/web/src/api/generated/` directory
- [ ] 7g.2 Delete `apps/web/src/api/unwrap.ts` (no longer needed with eden)
- [ ] 7g.3 Delete `apps/web/src/api/setup.ts` (generated client setup)
- [ ] 7g.4 Run `bun typecheck` — 0 errors
- [ ] 7g.5 Run `bun test` in apps/web — all pass
- [ ] 7g.6 Update PROGRESS.v2.md — mark c35 as DONE
- [ ] 7g.7 Commit: `feat(web): migrate frontend from generated v1 client to eden treaty v2`
