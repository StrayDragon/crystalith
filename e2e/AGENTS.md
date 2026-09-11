# E2E (Playwright) — critical browser gate

P0 suite lives in `tests/p0-smoke.spec.ts` + `tests/p0-eden-lab.spec.ts` (`@p0`). Selectors MUST use
`data-testid` from `apps/web/src/shared/testids.ts` — do not lock tests to Chinese copy.

**Production deep-research parity** is `p0-eden-lab.spec.ts` (Eden). Fixture-only
Lab compose smoke (e.g. S06b) is **not** a substitute.

```bash
just e2e-install   # once (optional if using system Chrome)
just e2e           # @p0 gate
just e2e-all       # full suite (@p0|@p1)
just qa            # primary PR gate (includes e2e @p0 + web Rstest)
```

## Isolation from `just dev`

|                 | `just dev`                                 | `just e2e`                                        |
| --------------- | ------------------------------------------ | ------------------------------------------------- |
| Ports           | web `:3000`, API `:8032`                   | web `:13000`, API `:18032`, mock gateway `:18039` |
| DB              | `data/crystalith.db`                       | fresh `e2e/.tmp/crystalith.e2e.db`                |
| `CL_*` gateways | loaded via `scripts/load-cl-env.sh` (live) | mock OpenAI gateway + `CL_RESEARCH_E2E_STUB=1`    |
| Lab mode        | Eden default                               | **Eden only** (fixture mode decommissioned)       |

On failure: Playwright keeps screenshot/trace/video; Eden Lab tests also attach run JSON + full-page shot via `attachResearchDiagnostics`.
