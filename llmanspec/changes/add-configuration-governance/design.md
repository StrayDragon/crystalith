# add-configuration-governance — Design Decisions

## 1. Configuration source priority

```
CL_* env vars  (highest)
   ↓ overrides
config/app.yaml
   ↓ fills gaps
Hardcoded defaults  (lowest)
```

This matches existing practice (CL_DB_PATH → storage.data_root → ./data) and is familiar to users of 12-factor-app style config.

## 2. Storage path alignment

`shared/storage.ts` will change its `DEFAULT_BASE` from:

```
~/.crystalith/storage  (old, independent)
```

to:

```
join(getDataRoot(), 'storage')  (new, unified)
```

Users who previously set `CL_STORAGE_PATH` must migrate to `CL_DATA_ROOT`. This is a **BREAKING** change for the env var, but the feature isn't widely used yet.

## 3. SearXNG fallback elimination

Current `research/agent.ts:267`:

```ts
const host = getSearxngHost() || 'http://localhost:8080';
```

Will change to:

```ts
const host = getSearxngHost();
if (!host) return []; // graceful degradation
```

The `getSearxngHost()` already returns `''` when unconfigured. The silent fallback to `localhost:8080` is misleading — it gives a false positive (200 from any local service on port 8080, not necessarily SearXNG).

## 4. Non-goals

- UI/frontend constants are out of scope (keep hardcoded as-is)
- This spec does NOT mandate a centralized config registry — only constrains the pattern
- Secret management beyond `secret.env` is deferred to c13 (Server Mode / production deployment)
