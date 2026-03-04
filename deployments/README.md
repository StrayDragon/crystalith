# Deployments

This directory is the deployment entrypoint using Docker Compose native merge (`-f`).

Core terminology mapping:
- `frontend` => compose service `web`
- `backend` => compose service `api`

## Compose Layers

- Core: `deployments/prod/docker-compose.yml`
- Optional storage: `deployments/prod/docker-compose.storage.yml`
- Optional redis: `deployments/prod/docker-compose.redis.yml`
- Optional searxng: `deployments/prod/docker-compose.searxng.yml`
- Optional ollama: `deployments/prod/docker-compose.ollama.yml`
- Optional slidev: `deployments/prod/docker-compose.slidev.yml`
- Optional host remap: `deployments/prod/docker-compose.host-remap.yml`

## Quick Start

```bash
cp .env.example .env
just dev-docker-up
```

Default `just dev-docker-up` starts a developer stack: core + `storage redis searxng`.

Dev-friendly preset (core + storage + redis + searxng, with China mirrors as build defaults):

```bash
just dev-docker-up
```

## Dev deps (host hot reload)

If you want fast reload (backend/frontend on host) but still want Docker-managed
dependencies (Postgres/Chroma/Redis/Ollama/SearXNG), use the dev deps composition:

```bash
cp .env.example .env
just dev
# or (deps only):
just dev-deps-up
```

## Optional Composition Examples

Core + storage:

```bash
docker compose --env-file .env \
  -f deployments/prod/docker-compose.yml \
  -f deployments/prod/docker-compose.storage.yml \
  up -d --build
```

Core + storage + redis + searxng + ollama:

```bash
docker compose --env-file .env \
  -f deployments/prod/docker-compose.yml \
  -f deployments/prod/docker-compose.storage.yml \
  -f deployments/prod/docker-compose.redis.yml \
  -f deployments/prod/docker-compose.searxng.yml \
  -f deployments/prod/docker-compose.ollama.yml \
  up -d --build
```

With `just`:

```bash
just DEV_OPTIONALS="storage" dev-docker-up
just DEV_OPTIONALS="storage redis searxng" dev-docker-up
just DEV_OPTIONALS="storage redis searxng ollama" dev-docker-up
just DEV_OPTIONALS="storage redis searxng ollama slidev" dev-docker-up
just DEV_OPTIONALS="storage redis" dev-docker-down
```

## Optional Services and External Replacement

- `storage`: runs `postgres` + `chromadb`. You can replace with external services by setting `DATABASE_URL` / `CHROMA_HOST` / `CHROMA_PORT`.
- `redis`: enables redis cache via `CACHE_PROVIDER=redis` and `REDIS_URL`.
- `searxng`: runs a local SearXNG instance for web search. If you use external SearXNG, set `CRYSTALITH_SEARCH__SEARXNG__HOST` and skip this overlay.
- `ollama`: runs local ollama. If you use external/host ollama, set `OLLAMA_HOST` and skip this overlay.
- `slidev`: local slide preview service.
- `host-remap`: host-network socat bridge for VPN/Tailscale scenarios.

## Overlay Enablement & Acceptance

Use `/health/dependencies` (or the Workspace Diagnostics panel) as the single source of truth for optional service status.

### storage (postgres + chromadb)

Enable when you need durable DB + vector storage outside the API container (recommended for long‑running self-host setups).

- Enable: add `-f deployments/prod/docker-compose.storage.yml` (or `just DEV_OPTIONALS="storage ..."`).
- External replacement: set `DATABASE_URL`, `CHROMA_HOST`, `CHROMA_PORT` and omit the overlay services.
- Acceptance:
  - `curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/health/dependencies" | python3 -m json.tool | head -80`
  - Verify `optional.storage_chroma.enabled == true` and status is not `unknown`.

### redis

Enable when you want caching for embeddings/vector search and lower latency.

- Enable: add `-f deployments/prod/docker-compose.redis.yml`.
- External replacement: set `CACHE_PROVIDER=redis`, `REDIS_URL=...` and omit the overlay service.
- Acceptance:
  - Verify `optional.cache_redis.enabled == true` and status is not `unknown`.

### ollama

Enable when you want fully local models (no external LLM provider).

- Enable: add `-f deployments/prod/docker-compose.ollama.yml`.
- External replacement: set `OLLAMA_HOST=...` and omit the overlay service.
- Acceptance:
  - Verify `optional.ollama.enabled == true` and endpoint matches `OLLAMA_HOST`.

### searxng

Enable when you want built-in web search / deep research to run without an external search provider.

- Enable: add `-f deployments/prod/docker-compose.searxng.yml`.
- External replacement: set `CRYSTALITH_SEARCH__SEARXNG__HOST=...` and omit the overlay service.
- Acceptance:
  - Verify `optional.search_searxng.enabled == true` and status is not `unknown`.

### slidev

Enable when you want slide preview service in the same compose project.

- Enable: add `-f deployments/prod/docker-compose.slidev.yml`.
- Acceptance:
  - Verify the Slidev container is running: `docker compose ps slidev`
  - (Optional) check `http://localhost:${CL_SLIDEV_PORT:-3030}`.

### host-remap

Enable only for special networking setups (VPN/Tailscale, host-network forwarding).

- Enable: add `-f deployments/prod/docker-compose.host-remap.yml`.
- Acceptance:
  - Configure `BRIDGE_FORWARDS` and verify the forwarded ports are reachable from within containers.

## Acceptance (core)

```bash
just dev-docker-smoke
```

Full composition smoke (core-only + optional late start + external service wiring):

```bash
just composition-smoke
# or:
SMOKE_SCENARIOS="core-only single-optional" ./scripts/composition_smoke.sh
# optional: clean compose volumes during reset
SMOKE_PRUNE_VOLUMES=1 ./scripts/composition_smoke.sh
```

Manual:

```bash
curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/health"
curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/health/dependencies"
curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/v1/models"
```

## merge/include Rule

- Main path: Compose merge via multiple `-f` files.
- `include` is not used by default in this repo.

## Behavior Changes

- Default topology is now core-only (`web` + `api`); optional services are opt-in overlays.
- `/health/dependencies` now returns unified optional-service status fields: `status`, `healthy`, `last_probe`, `error_code`, `recovery_hint`.
- Optional cache/probe failures are fail-open for core routes: `/health` and core APIs stay available.
- Environment monitor variables are unified to `CRYSTALITH_OPTIONAL_SERVICES_MONITOR_*`.

## Migration

Old command calls are removed; switch to new entrypoints directly:

- `just dev-up` -> `just dev-docker-up`
- `just dev-down` -> `just dev-docker-down`
- `just dev-ps` -> `just dev-docker-ps`
- `just dev-logs` -> `just dev-docker-logs`
- `just dev-rebuild <service>` -> `just dev-docker-rebuild <service>`
- `just dev-smoke` -> `just dev-docker-smoke`
- `CRYSTALITH_OLLAMA_MONITOR_*` -> `CRYSTALITH_OPTIONAL_SERVICES_MONITOR_*`

Rollback path (temporary):

- To emulate previous “full dependency” startup behavior, explicitly enable all overlays:
  `just DEV_OPTIONALS="storage redis searxng ollama slidev" dev-docker-up`
