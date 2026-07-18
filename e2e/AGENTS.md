# E2E (Playwright) — critical browser gate

P0 suite lives in `tests/p0-smoke.spec.ts` (`@p0`). Selectors MUST use
`data-testid` from `apps/web/src/shared/testids.ts` — do not lock tests to Chinese copy.

```bash
just e2e-install   # once
just e2e           # @p0 gate
just e2e-all       # full suite
just qa            # ultimate gate (includes e2e)
```

Isolated ports: web `13000`, API `18032`, DB `e2e/.tmp/crystalith.e2e.db`.
