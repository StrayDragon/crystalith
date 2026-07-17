## Decision

**Big-bang camelCase wire + Eden as the only TS client SSOT.**

```
packages/shared Zod (camelCase)
        │
        ├─► Elysia routes (validate + serialize)
        ├─► OpenAPI / Scalar
        └─► apps/web: treaty<App> + shared types
              （无 Api* 平行线、无 snake normalize）
```

### Naming rules

| Kind                      | Rule                    | Example                                |
| ------------------------- | ----------------------- | -------------------------------------- |
| JSON object fields        | camelCase               | `notebookId`, `sourceIds`, `createdAt` |
| URL path segments         | keep existing `/v2/...` | unchanged                              |
| Query/body keys           | camelCase               | `?notebookId=1`                        |
| SSE event **names**       | keep                    | `chunk`, `done`, `error`               |
| SSE event **data** fields | camelCase               | `messageId`, `noEvidenceReason`        |
| DB columns (Drizzle)      | unchanged               | `notebook_id` column → map in code     |
| Config/env keys           | unchanged               | `OPENAI_API_KEY`                       |

### Serialization pattern

Prefer: Zod schema `.parse()` / Elysia body schema as the response shape; avoid hand-built `{ notebook_id: row.notebookId }` maps. Where a map remains, it MUST emit camelCase keys matching shared schemas.

### Eden vs OpenAPI

| Consumer                              | Mechanism                                              |
| ------------------------------------- | ------------------------------------------------------ |
| Crystalith Web / future Tauri webview | Eden `treaty<App>`                                     |
| Humans / external tools               | OpenAPI JSON + Scalar UI                               |
| Non-TS clients                        | Consume OpenAPI; project does not ship hey-api codegen |

Eden does **not** block exports or packaging: export endpoints remain HTTP; Tauri sidecar still serves `/v2/*`.

### Migration phases (implementation order)

1. **Shared SSOT** — rename Zod fields; fix shared tests; regenerate openapi artifact if checked in.
2. **Server** — update routers/serializers/SSE/export; fix server tests + BDD.
3. **DB JSON migrate** — script + one-shot migrate on boot or `just` task for embedded citations.
4. **Web** — switch call sites to camelCase; delete normalize snake maps; delete/trim `shared-types.ts` / `Api*`.
5. **Gate** — `bun typecheck`, targeted tests, `just qa` (or project equivalent).

### Alternatives rejected

- **Eden-only, keep snake wire** — types improve, dual-track naming remains; rejected for “一步到位”.
- **Dual-write snake+camel** — doubles surface; rejected per project no-compat rule.
- **Domain-by-domain forever** — already started with Citation; remaining dual-track cost too high.

### Rollout / rollback

- Single merge; no API version bump required if still `/v2` (document as breaking within v2).
- Rollback = revert git commit + restore DB from backup if JSON migrate ran.
- Local dev: wipe `data/` acceptable when migrate is hard.

### Blast radius (inventory hints for implementers)

- `packages/shared/src/schemas/**` (~17 files)
- `apps/server/src/features/**/router.ts` + `serialize*` helpers
- `apps/server/src/features/qa/**`, streaming schemas
- `apps/web/src/api/shared-types.ts`, `features/workspace/shared/types.ts`, `utils.ts` normalize*
- `apps/web/src/features/workspace/domains/**` hooks
- `apps/server/tests/bdd/**`, `apps/server/test/**`, web vitest
- Archive note: c64 Citation rules stay; extend to all objects
