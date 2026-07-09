# c35: Frontend API Migration (generated client → eden treaty)

## Why

The v2 backend (Elysia + AI SDK v7) is complete with all 20 feature routers mounted. However, the frontend still uses the v1 generated API client (`@hey-api/openapi-ts` generated from v1 OpenAPI spec). Most AI/streaming features hit `/v1/*` endpoints that no longer exist (404). The eden treaty client is scaffolded and `api.v2.*` is ready, but only 4 domains (notebooks, sessions, templates, prompt-presets) have been migrated.

## What Changes

1. **Replace imported generated client functions** with eden treaty calls (`api.v2.*`) across all remaining domains:
   - chat/QA (`useChat.ts`) — streaming + non-streaming
   - sources (`useSources.ts`)
   - research (`useResearch.ts`)
   - analysis (`useAnalysis.ts`)
   - refine (`useRefine.ts`)
   - studio (`SlidesStudioDialog.tsx`, `ModelSelector.tsx`)
   - outputs (`useOutputQueue.ts`)
   - tasks (`useTasks.ts`)
   - citations (`CitationDrawer.tsx`)
   - commands (`useCommands.ts`)
   - shared (`evidenceExport.ts`, `useDependencyHealth.ts`, `useGraphSessionDetail.ts`)

2. **Replace hardcoded `/v1/` SSE/export URLs** with `/v2/` equivalents:
   - QA stream: `/v1/notebooks/{nid}/qa/stream` → `/v2/qa/stream`
   - Research stream: `/v1/notebooks/{nid}/research/{id}/stream` → `/v2/research/{id}/stream`
   - Studio outline/markdown streams
   - Evidence export URLs

3. **Delete generated client** (`apps/web/src/api/generated/`) after all references removed

4. **Adapt streaming approach** — The v1 generated client used `client.sse.post()`. For v2 eden, streaming endpoints will use `fetch()` directly with eden-constructed URLs (or a streaming adapter) since eden treaty doesn't have native SSE support.

## Capabilities

- `frontend-eden-migration`

## Impact

- **BREAKING**: All v1 `/v1/` endpoints are replaced with `/v2/` equivalents
- Frontend typecheck errors drop from 207 → manageable level
- AI features become functional (chat, research, analysis, studio, etc.)
- All 74 generated client references eliminated
