# Deployment (Docker Compose)

Crystalith deployment uses Docker Compose native merge (`-f`) with a core stack and optional overlays.

Core terminology mapping:
- `frontend` => compose service `web`
- `backend` => compose service `api`

## Core Only (recommended baseline)

```bash
cp .env.example .env
docker compose --env-file .env -f deployments/prod/docker-compose.yml up -d --build
```

Then open:
- Web UI: `http://localhost:${CL_WEB_PORT:-8080}`
- Health: `http://localhost:${CL_WEB_PORT:-8080}/health`
- Dependency health: `http://localhost:${CL_WEB_PORT:-8080}/health/dependencies`

## Optional Overlays

- `deployments/prod/docker-compose.storage.yml`: postgres + chromadb
- `deployments/prod/docker-compose.redis.yml`: redis cache
- `deployments/prod/docker-compose.ollama.yml`: local ollama
- `deployments/prod/docker-compose.slidev.yml`: slidev preview
- `deployments/prod/docker-compose.host-remap.yml`: host-network remap bridge

Example: core + storage + redis + ollama

```bash
docker compose --env-file .env \
  -f deployments/prod/docker-compose.yml \
  -f deployments/prod/docker-compose.storage.yml \
  -f deployments/prod/docker-compose.redis.yml \
  -f deployments/prod/docker-compose.ollama.yml \
  up -d --build
```

## Using `just`

`just dev-docker-up` 默认使用开发者组合：`storage redis`，并内置中国镜像构建默认值。

```bash
just dev-docker-up
just DEV_OPTIONALS="storage" dev-docker-up
just DEV_OPTIONALS="storage redis ollama" dev-docker-up
just DEV_OPTIONALS="storage redis ollama slidev" dev-docker-up
just DEV_OPTIONALS="storage redis" dev-docker-down
```

## Acceptance (smoke test)

```bash
just dev-docker-smoke
```

Full composition smoke:

```bash
just composition-smoke
# or:
SMOKE_SCENARIOS="core-only single-optional" ./scripts/composition_smoke.sh
# optional: clean compose volumes during reset
SMOKE_PRUNE_VOLUMES=1 ./scripts/composition_smoke.sh
```

Manual checks:

```bash
curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/health"
curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/health/dependencies"
curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/v1/models"

curl -fsS -X POST "http://localhost:${CL_WEB_PORT:-8080}/v1/notebooks" \
  -H 'Content-Type: application/json' \
  -d '{"name":"smoke"}'
```

## External Service Replacement

- Storage: set `DATABASE_URL`, `CHROMA_HOST`, `CHROMA_PORT` to your own services.
- Redis: set `CACHE_PROVIDER=redis`, `REDIS_URL=...`.
- Ollama: set `OLLAMA_HOST` to external/host Ollama and skip local ollama overlay.

## Notes

- Main path is merge (`-f`) composition.
- `include` is intentionally not used in default deployment path.

## Behavior Changes

- Default startup is core-only (`web` + `api`) and no longer auto-enables optional dependencies.
- Optional dependency health is standardized in `/health/dependencies` with:
  `status`, `healthy`, `last_probe`, `error_code`, `recovery_hint`.
- Optional service failures degrade optional capabilities instead of taking down core health routes.
- Runtime monitor env names are now `CRYSTALITH_OPTIONAL_SERVICES_MONITOR_*`.

## Migration

Old local-entry commands are removed; switch to:

- `just dev-up` -> `just dev-docker-up`
- `just dev-down` -> `just dev-docker-down`
- `just dev-ps` -> `just dev-docker-ps`
- `just dev-logs` -> `just dev-docker-logs`
- `just dev-rebuild <service>` -> `just dev-docker-rebuild <service>`
- `just dev-smoke` -> `just dev-docker-smoke`
- `CRYSTALITH_OLLAMA_MONITOR_*` -> `CRYSTALITH_OPTIONAL_SERVICES_MONITOR_*`

Rollback path:

- Explicitly turn on all overlays to approximate previous full stack behavior:
  `just DEV_OPTIONALS="storage redis ollama slidev" dev-docker-up`
