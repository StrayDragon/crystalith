# Design: Frontend API Client Simplification

## Current State (Observed)
- `frontend/web/src/api/generated/client.gen.ts` exports a configured generated client.
- `frontend/web/src/api/client.ts` wraps generated endpoints, adds `ApiError` + `handleResponse`, and implements several endpoints via manual `fetch` (SSE, extractors, conversions, etc.).
- Domain code imports the wrapper for both functions and types, which increases churn when the wrapper changes.

## Decision Drivers
- Lower maintenance burden for API surface changes.
- Keep call sites simple and discoverable.
- Avoid breaking behavior or error messaging.
- Minimize bespoke wrappers for endpoints that can be represented in OpenAPI.

## Options
### Option A: Direct generated imports + small manual module (recommended)
- Use `frontend/web/src/api/generated` exports directly in feature code.
- Create a tiny `frontend/web/src/api/manual.ts` (or similar) for:
  - SSE QA streaming
  - Any endpoints not yet in OpenAPI (source-from-URL, extractors, conversions, etc.)
- Keep a small shared `api/errors.ts` to normalize errors for manual fetch only.

**Pros:** Lowest maintenance, clear separation of generated vs. bespoke calls.
**Cons:** More direct generated imports across the codebase; tests must be updated to mock generated functions.

### Option B: Keep wrapper but make it thin
- Keep `client.ts` as a narrow re-export + error helper.
- Move all non-generated calls into a separate module and avoid duplicating generated method signatures.

**Pros:** Minimal churn for call sites.
**Cons:** Still a maintenance hotspot; wrapper can drift from generated schema.

### Option C: Extend OpenAPI coverage and remove manual fetch
- Add missing endpoints to OpenAPI; regenerate frontend SDK so all calls are generated.
- Remove manual fetch calls altogether.

**Pros:** Cleanest surface, consistent typing.
**Cons:** Requires backend OpenAPI updates and may be more work up front.

## Proposed Direction
Start with Option A. Use generated endpoints directly where available, and isolate manual calls to a small module with clear comments on why they are manual. Evaluate whether to promote manual endpoints into OpenAPI in a follow-up if usage or drift becomes costly.

## Generated Client Best Practices (Hey API)
- Prefer calling the generated SDK functions directly; use the generated `client` instance for configuration rather than wrapping every endpoint. Use `client.setConfig()` early in app bootstrap for base URL/auth when the app can guarantee configuration happens before first call. Otherwise, use `runtimeConfigPath` + `createClientConfig()` so `client.gen.ts` configures itself at init time.
- Use `client.interceptors` (or native fetch/ofetch hooks) to centralize auth headers, request/response transforms, or error normalization instead of per-endpoint wrappers.
- For one-off overrides (alternate base URL or testing), create a client instance with `createClient()` or pass configuration options per SDK call.

## Risks
- Large refactor touching many imports and tests.
- Inconsistent error shape between generated and manual calls if not normalized.
- Mocking setup in tests may need adjustments.

## Open Questions
- Are we comfortable updating OpenAPI to cover the missing endpoints now, or should that be a separate change?
- Should we standardize on generated error shapes or keep `ApiError` for manual fetch only?
