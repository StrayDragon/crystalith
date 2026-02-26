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
