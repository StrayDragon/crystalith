# add-configuration-governance — Tasks

## Phase 1: Spec creation

- [x] Create change directory and artifact skeleton
- [x] Write proposal.md
- [x] Write delta spec (configuration-governance) with 8 requirements + scenarios
- [x] Validate change: `llman sdd validate add-configuration-governance --strict --no-interactive`

## Phase 2: Code alignment

- [x] Align `shared/storage.ts`: replace `CL_STORAGE_PATH` + `~/.crystalith/storage` with `join(getDataRoot(), 'storage')`
  - Verify: `bun test test/shared/storage.test.ts` ✅
- [x] Eliminate hardcoded `http://localhost:8080` fallback in `research/agent.ts`
  - Verify: searxngFetch returns `[]` when no SearXNG configured (no silent fallback) ✅
- [x] Run full test suite: `cd apps/server && bun test` ✅ 280 pass, 1 pre-existing fail (CL_SEARXNG_HOST env unrelated)

## Phase 3: Spec finalization

- [x] Review and update `data-and-storage` spec to reference `configuration-governance` for path governance
- [x] Final validation: `llman sdd validate add-configuration-governance --strict --no-interactive`
