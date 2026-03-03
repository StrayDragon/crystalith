## 1. Backend: shared types + plugin interface

- [x] 1.1 Add `FrontendBundleDescriptor` (pydantic) to `crystalith.shared.plugins` shared types
- [x] 1.2 Extend `OutputTypePlugin` protocol to allow optional `frontend_bundle`
- [x] 1.3 Extend plugin compliance checker to validate `frontend_bundle` type
- [x] 1.4 Extend `PluginRegistry` to store/query `frontend_bundle` per output_type

## 2. Backend: workspace tools API

- [x] 2.1 Add `frontend_bundle` field to `WorkspaceTool` response model
- [x] 2.2 Populate `frontend_bundle` from output type plugins (and/or builtin mapping if needed)
- [x] 2.3 Add/adjust backend tests to cover tools response includes `frontend_bundle`
- [x] 2.4 Add a config flag to enable/disable emitting `frontend_bundle` (for fallback testing)

## 3. Frontend: types + store

- [x] 3.1 Add frontend-bundle types to workspace shared types
- [x] 3.2 Extend workspace store to cache `outputTypeFrontendBundles`
- [x] 3.3 Update `useRefine` normalization to store `frontend_bundle` from tools API

## 4. Frontend: builtin bundle loader

- [x] 4.1 Add deterministic builtin bundle registry (id → dynamic import loader)
- [x] 4.2 Update `OutputContent` to render with priority `frontend_bundle > GenericOutputRenderer > Raw JSON`
- [x] 4.3 Add frontend tests for bundle loading success/failure fallback

## 5. OpenAPI + generated client

- [x] 5.1 Regenerate backend OpenAPI (if needed) and run `pnpm run api:sync`
- [x] 5.2 Fix any type drift in frontend usage of generated types

## 6. Verification

- [x] 6.1 Run backend `just test` (or targeted pytest) and ensure plugin tests pass
- [x] 6.2 Run frontend `pnpm test` and `pnpm typecheck`
- [x] 6.3 DevTools verify: opening outputs triggers bundle dynamic imports and renders interactive UI
- [x] 6.4 DevTools verify: disabling bundles falls back to GenericOutputRenderer / Raw JSON
