# E2E (Playwright) — critical browser gate

P0 suite lives in `tests/p0-smoke.spec.ts` (`@p0`, **28** cases). Selectors MUST use
`data-testid` from `apps/web/src/shared/testids.ts` — do not lock tests to Chinese copy.

Coverage taxonomy and history: see `e2e/` directory documentation.

```bash
just e2e-install   # once (optional if using system Chrome)
just e2e           # @p0 gate
just e2e-all       # full suite (currently same as @p0)
just qa            # primary PR gate (includes e2e @p0 + web Vitest)
```

## Isolation from `just dev`

|                 | `just dev`                                 | `just e2e`                         |
| --------------- | ------------------------------------------ | ---------------------------------- |
| Ports           | web `:3000`, API `:8032`                   | web `:13000`, API `:18032`         |
| DB              | `data/crystalith.db`                       | fresh `e2e/.tmp/crystalith.e2e.db` |
| `CL_*` gateways | loaded via `scripts/load-cl-env.sh` (live) | stubbed to `127.0.0.1:9` (offline) |

P0 does **not** require LLM/embedding. Source upload may land `failed`/`EMBEDDING_FAILED`; that is expected offline.
