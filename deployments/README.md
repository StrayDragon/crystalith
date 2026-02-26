# Deployments

This directory is the deployment entrypoint using Docker Compose native merge (`-f`).

Core terminology mapping:
- `frontend` => compose service `web`
- `backend` => compose service `api`

## Compose Layers

- Core: `deployments/prod/docker-compose.yml`
- Optional storage: `deployments/prod/docker-compose.storage.yml`
- Optional redis: `deployments/prod/docker-compose.redis.yml`
- Optional ollama: `deployments/prod/docker-compose.ollama.yml`
- Optional slidev: `deployments/prod/docker-compose.slidev.yml`
- Optional host remap: `deployments/prod/docker-compose.host-remap.yml`

## Quick Start

```bash
cp .env.example .env
just dev-docker-up
```

Default `just dev-docker-up` starts a developer stack: core + `storage redis`.

Dev-friendly preset (core + storage + redis, with China mirrors as build defaults):

```bash
just dev-docker-up
```

## Optional Composition Examples

Core + storage:

```bash
docker compose --env-file .env \
  -f deployments/prod/docker-compose.yml \
  -f deployments/prod/docker-compose.storage.yml \
  up -d --build
```

Core + storage + redis + ollama:

```bash
docker compose --env-file .env \
  -f deployments/prod/docker-compose.yml \
  -f deployments/prod/docker-compose.storage.yml \
  -f deployments/prod/docker-compose.redis.yml \
  -f deployments/prod/docker-compose.ollama.yml \
  up -d --build
```

With `just`:

```bash
just DEV_OPTIONALS="storage" dev-docker-up
just DEV_OPTIONALS="storage redis ollama" dev-docker-up
just DEV_OPTIONALS="storage redis ollama slidev" dev-docker-up
just DEV_OPTIONALS="storage redis" dev-docker-down
```

## Optional Services and External Replacement

- `storage`: runs `postgres` + `chromadb`. You can replace with external services by setting `DATABASE_URL` / `CHROMA_HOST` / `CHROMA_PORT`.
- `redis`: enables redis cache via `CACHE_PROVIDER=redis` and `REDIS_URL`.
- `ollama`: runs local ollama. If you use external/host ollama, set `OLLAMA_HOST` and skip this overlay.
- `slidev`: local slide preview service.
- `host-remap`: host-network socat bridge for VPN/Tailscale scenarios.

## Acceptance (core)

```bash
just dev-docker-smoke
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
