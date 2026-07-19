# E2E (Playwright) — critical browser gate

P0 suite lives in `tests/p0-smoke.spec.ts` (`@p0`, **26** cases). Selectors MUST use
`data-testid` from `apps/web/src/shared/testids.ts` — do not lock tests to Chinese copy.

Coverage taxonomy and history: repo-root `_E2E.md`.

```bash
just e2e-install   # once (optional if using system Chrome)
just e2e           # @p0 gate
just e2e-all       # full suite (currently same as @p0)
just qa            # primary PR gate (includes e2e @p0; not all tests)
```

Isolated ports: web `13000`, API `18032`, DB `e2e/.tmp/crystalith.e2e.db`.
