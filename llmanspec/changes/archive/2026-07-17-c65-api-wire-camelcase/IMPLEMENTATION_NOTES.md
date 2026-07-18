# c65 Implementation Notes (APPROVED)

## Summary

HTTP/SSE JSON wire fields are camelCase end-to-end. `packages/shared` Zod is the SSOT.
Review agent verdict: **APPROVE** (post Review #5 MUST fixes + residual dual-read cleanup).

## Gates

- `bun typecheck` (root) — ✅ 3/3 packages
- `cd apps/server && bun test` — ✅ 267/267
- `cd packages/shared && bun test` — ✅ 12/12
- `llman sdd validate c65-api-wire-camelcase --strict --no-interactive` — ✅

## Residual cleanup (post-APPROVE)

- Removed last `theme_preset` dual-reads in `slides.ts` / `useRefine.ts`
- Aligned error/comment strings mentioning `notebook_id` → `notebookId` where they describe wire
- Updated `errors.ts` / `parseServerError.ts` comments to camelCase field names

## Explicit exclusions / follow-ups

- `packages/shared/.../output.ts` `key_points`: **content-tree** semantic field (not API envelope); kept
- Web vitest infra/mocks: **deferred to c66** (task 4.4 note)
- Existing DBs: wipe `data/` (dev) — no JSON migration script required when wiping is acceptable
- DB column names unchanged (non-goal)

## Wire contract

**BREAKING**: All HTTP/SSE JSON field names are camelCase. SSE **event names** unchanged
(`chunk` | `state_snapshot` | `done` | `error`). No snake wire compat layer.
