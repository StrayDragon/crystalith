# Tasks: Simplify frontend API client

- [ ] 1. Audit `frontend/web/src/api/client.ts` for manual endpoints and categorize:
      - Generated equivalents (can be deleted)
      - Missing in OpenAPI (needs manual module or OpenAPI update)
      - Streaming/SSE (special handling)
- [ ] 2. Decide approach (Option A/B/C) and document final choice.
- [ ] 3. If using Option A or B, create a minimal manual module and shared error helper; wire generated client config.
- [ ] 4. Update feature code imports to use generated functions directly or the new manual module.
- [ ] 5. Update tests/mocks to target the new import paths.
- [ ] 6. Run `pnpm run api:generate` if OpenAPI additions are made; ensure `just sdk-gen` remains consistent.
- [ ] 7. Verify with `pnpm test` (frontend) and any targeted tests touched by the refactor.
