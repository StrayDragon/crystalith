# Deployment (Docker Compose)

Crystalith deployment uses Docker Compose native merge (`-f`) with a core stack and optional overlays.

Core terminology mapping:
- `frontend` => compose service `web`
- `backend` => compose service `api`

## Core Only (recommended baseline)

```bash
cp .env.example .env
cp config/secrets.yaml.example config/secrets.yaml
docker compose --env-file .env -f deployments/prod/docker-compose.yml up -d --build
```

Note:
- The default deployment images are **core-only**. Optional capabilities (studio tool output types, PDF/HTML/media parsers, URL fetch extractors) live in official plugins.
- For a “full capability” self-host, build a custom API image that installs `crystalith[official-full]` (or the smaller `official-*` bundles) and ensure plugins are enabled via `config/app.yaml`.

Build note (China mirrors):
- By default, the Dockerfiles may use China mirrors to speed up builds.
- In CI, mirrors are disabled automatically.
- To disable locally: `USE_CN_MIRROR=0 docker compose ... --build`

## Using GHCR prebuilt images (no local build)

If you prefer not to build from source, you can pull the versioned runtime images from GHCR.

Network note (proxy):
- If you have trouble pulling images from GHCR, configure Docker to use a proxy.
- Example one-off environment (adjust for your setup): `HTTPS_PROXY=http://127.0.0.1:20171`

Recommended tag selection:
- Prefer an exact version tag: `X.Y.Z`
- Use `sha-<shortsha>` only for debugging/repro
- Avoid `latest` for production pinning

Minimal example (core-only):

```bash
export OWNER="<github-org-or-user>"
export VERSION="X.Y.Z"

docker pull "ghcr.io/${OWNER}/crystalith-api:${VERSION}"
docker pull "ghcr.io/${OWNER}/crystalith-web:${VERSION}"

docker network create crystalith-smoke >/dev/null 2>&1 || true

docker run -d --name crystalith-api --network crystalith-smoke --network-alias api \
  -e CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED=0 \
  -v "$PWD/data:/app/data" \
  -v "$PWD/config:/app/config:ro" \
  -p 8032:8032 \
  "ghcr.io/${OWNER}/crystalith-api:${VERSION}"

docker run -d --name crystalith-web --network crystalith-smoke \
  -p 8080:8080 \
  "ghcr.io/${OWNER}/crystalith-web:${VERSION}"

curl -fsS "http://localhost:8080/health"
```

Cleanup:

```bash
docker rm -f crystalith-web crystalith-api
docker network rm crystalith-smoke
```

Then open:
- Web UI: `http://localhost:${CL_WEB_PORT:-8080}`
- Health: `http://localhost:${CL_WEB_PORT:-8080}/health`
- Dependency health: `http://localhost:${CL_WEB_PORT:-8080}/health/dependencies`
- API (via Nginx front door): `http://localhost:${CL_WEB_PORT:-8080}/v1/`

Note: The API is served through the `web` (Nginx) front door. Requests to `/v1/*` are reverse-proxied to the internal `api:8032` service.

Security note: by default the API is **unauthenticated**. Do not expose `CL_WEB_PORT` to the public internet without adding protection (see `app.auth` in `Configuration`).

## Optional Overlays

- `deployments/prod/docker-compose.storage.yml`: postgres + chromadb
- `deployments/prod/docker-compose.redis.yml`: redis cache
- `deployments/prod/docker-compose.searxng.yml`: searxng web search
- `deployments/prod/docker-compose.ollama.yml`: local ollama
- `deployments/prod/docker-compose.slidev.yml`: slidev preview (and, by default, installs `official-slides` into the API image)
- `deployments/prod/docker-compose.host-remap.yml`: host-network remap bridge

Example: core + storage + redis + searxng + ollama

```bash
docker compose --env-file .env \
  -f deployments/prod/docker-compose.yml \
  -f deployments/prod/docker-compose.storage.yml \
  -f deployments/prod/docker-compose.redis.yml \
  -f deployments/prod/docker-compose.searxng.yml \
  -f deployments/prod/docker-compose.ollama.yml \
  up -d --build
```

## Using `just`

`just dev-docker-up` 默认使用开发者组合：`storage redis searxng`，并内置中国镜像构建默认值。

```bash
just dev-docker-up
just DEV_OPTIONALS="storage" dev-docker-up
just DEV_OPTIONALS="storage redis searxng" dev-docker-up
just DEV_OPTIONALS="storage redis searxng ollama" dev-docker-up
CRYSTALITH_BACKEND_EXTRAS=official-slides just DEV_OPTIONALS="storage redis searxng ollama slidev" dev-docker-up
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
# If API auth is enabled (app.auth.enabled=true):
# curl -fsS -H "Authorization: Bearer $CRYSTALITH_API_KEY" "http://localhost:${CL_WEB_PORT:-8080}/v1/models"

curl -fsS -X POST "http://localhost:${CL_WEB_PORT:-8080}/v1/notebooks" \
  -H 'Content-Type: application/json' \
  -d '{"name":"smoke"}'
# If API auth is enabled (app.auth.enabled=true), add:
#   -H "Authorization: Bearer $CRYSTALITH_API_KEY"
```

## External Service Replacement

- Storage: edit `config/app.yaml`:
  - `database.url` / `database.url_candidates` (+ secrets for password)
  - `vector_storage.chroma.host/port` or `vector_storage.chroma.endpoint_candidates`
- Redis: edit `config/app.yaml`:
  - `cache.provider: redis|auto`
  - `cache.redis_url` / `cache.redis_url_candidates`
- Ollama: edit `config/app.yaml`:
  - `optional_services.ollama.endpoint_candidates`
  - (Optional) switch `models.defaults.*` to an ollama-backed model id
- SearXNG: edit `config/app.yaml`:
  - `search.searxng.host` / `search.searxng.endpoint_candidates`

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
  `just DEV_OPTIONALS="storage redis searxng ollama slidev" dev-docker-up`
