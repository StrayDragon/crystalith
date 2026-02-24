# Deployment (Docker Compose)

The canonical production Compose stack lives in `deployments/prod/docker-compose.yml`.

## Quick Start (recommended)

```bash
cp .env.example .env
docker compose --env-file .env -f deployments/prod/docker-compose.yml up -d --build
```

Then open:

- Web UI: `http://localhost:${CL_WEB_PORT:-8080}`
- Backend health: `http://localhost:${CL_WEB_PORT:-8080}/health`
- API docs: `http://localhost:${CL_WEB_PORT:-8080}/v1/codev/openapi-ui/scalar`

## Acceptance (smoke test)

```bash
curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/health"
curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/v1/models"

curl -fsS -X POST "http://localhost:${CL_WEB_PORT:-8080}/v1/notebooks" \
  -H 'Content-Type: application/json' \
  -d '{"name":"smoke"}'
```

Note: the `refine` endpoint requires an AI provider (either set `OPENAI_API_KEY`, or enable the Ollama profile below).

## Offline (optional): Ollama profile

This starts an `ollama` container (no ports exposed) and switches backend defaults to the existing local model ids:

- chat: `qwen-local` (`qwen2.5-coder:1.5b`)
- embedding: `bge-m3-local` (`bge-m3:567m`)

```bash
cp .env.example .env
OLLAMA_HOST=http://ollama:11434 \
CRYSTALITH_DEFAULT_CHAT_MODEL=qwen-local \
CRYSTALITH_DEFAULT_EMBEDDING_MODEL=bge-m3-local \
docker compose --env-file .env -f deployments/prod/docker-compose.yml --profile ollama up -d --build
```

First run requires pulling the models (one-time, can take a while):

```bash
docker compose -f deployments/prod/docker-compose.yml --profile ollama exec -T ollama ollama pull qwen2.5-coder:1.5b
docker compose -f deployments/prod/docker-compose.yml --profile ollama exec -T ollama ollama pull bge-m3:567m
docker compose -f deployments/prod/docker-compose.yml --profile ollama exec -T ollama ollama ls
```

Offline smoke test (no OpenAI key):

```bash
curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/health"

curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/v1/models"

curl -fsS -X POST "http://localhost:${CL_WEB_PORT:-8080}/v1/notebooks" \
  -H 'Content-Type: application/json' \
  -d '{"name":"offline-smoke"}'

# Use the returned notebook id
curl -fsS -X POST "http://localhost:${CL_WEB_PORT:-8080}/v1/notebooks/<id>/refine" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Say hello in one sentence.","format":"paragraph"}'
```

## Registry pull proxy (optional)

If pulling images from registries times out, only use a proxy for the `docker pull` phase, then unset it before building.

Example:

```bash
# Set this to your local proxy (only for `docker pull`)
export HTTPS_PROXY=http://<proxy-host>:<proxy-port>

for img in \
  python:3.12-slim-trixie \
  ghcr.io/astral-sh/uv:0.10.2 \
  node:20-trixie-slim \
  nginx:1.29.5-trixie \
  postgres:18.1-trixie \
  chromadb/chroma:0.5.15 \
  redis:7.4-alpine \
  ollama/ollama:latest \
; do docker pull "$img"; done

# Important: unset proxy before building; use China mirrors instead (below).
unset HTTPS_PROXY HTTP_PROXY ALL_PROXY
```

## China mirrors (optional)

If Docker builds time out in mainland China, you can override build-time mirrors via env vars in `.env`:

```bash
APT_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/debian \
UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/ \
NPM_REGISTRY=https://registry.npmmirror.com \
docker compose --env-file .env -f deployments/prod/docker-compose.yml up -d --build
```

Notes:

- Mirrors are optional; defaults use upstream official sources.
- The backend Dockerfile only rewrites `deb.debian.org/debian` (it does not rewrite the Debian security repository).
- `UV_INDEX_URL` is used by `uv sync`.

## Notes

- `api` automatically runs Alembic migrations on startup (`AUTO_DB_INIT=1`).
- Startup cleanup of `FAILED` sources is **disabled by default**. To opt in, set `app.startup.cleanup_failed_sources: true` in `config/app.yaml` (or set `AUTO_CLEANUP_FAILED_SOURCES=1`). This deletes DB rows and may orphan related files/vectors.
- Data is persisted via Docker volumes (`pgdata`, `chromadata`, `api_data`).
- Redis is optional; enable it with:

```bash
REDIS_URL=redis://redis:6379/0 \
docker compose --env-file .env -f deployments/prod/docker-compose.yml --profile redis up -d
```

## Configuration

Copy `.env.example` to `.env` and edit as needed:

- `CL_WEB_PORT`: Public web port (default `8080`)
- `DATABASE_URL`: SQLAlchemy URL for PostgreSQL (async)
- `CACHE_PROVIDER` / `REDIS_URL`: Optional cache provider
- `OPENAI_API_KEY` / `OPENAI_BASE_URL`: Optional OpenAI-compatible provider
- `OLLAMA_HOST`: Optional Ollama host URL (for profile-based offline mode: `http://ollama:11434`; for host Ollama: `http://host.docker.internal:11434`)
- `CRYSTALITH_DEFAULT_CHAT_MODEL`: Override `models.defaults.chat` (must match an ID in `config/app.yaml`)
- `CRYSTALITH_DEFAULT_EMBEDDING_MODEL`: Override `models.defaults.embedding` (must match an ID in `config/app.yaml`)
- `CRYSTALITH_SECRETS_PATH`: Optional secrets file/dir (see below)
- `PYTHON_IMAGE` / `NODE_IMAGE` / `NGINX_IMAGE`: Override base images (advanced; Debian bookworm+)
- `UV_IMAGE`: uv image tag/digest used at build time (advanced)
- `POSTGRES_IMAGE` / `CHROMADB_IMAGE` / `REDIS_IMAGE` / `OLLAMA_IMAGE`: Override service image tags (advanced)
- `APT_MIRROR` / `UV_INDEX_URL` / `NPM_REGISTRY`: Build-time mirrors (requires rebuild)

The `api` service includes `extra_hosts: host.docker.internal:host-gateway` so containers can reach host services on Linux.

If you deploy the UI and API on different origins, update `config/app.yaml` to allow your UI origin via `app.cors.allow_origins`.

### Using host Ollama (Linux)

If Ollama only listens on `127.0.0.1:11434`, Docker containers cannot reach it. Prefer running Ollama on all interfaces:

```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

Then set `OLLAMA_HOST=http://host.docker.internal:11434` in `.env`.

## Docker Secrets (Optional)

`CRYSTALITH_SECRETS_PATH` can point to either:

- a YAML file (mapping of `KEY: value`), or
- a directory (Docker secrets style: one file per key)

Tip: `config/secrets.yaml.example` shows a safe template; copy it to `config/secrets.yaml` and keep it uncommitted.

Example directory layout:

```
/run/secrets/OPENAI_API_KEY
/run/secrets/SOME_OTHER_SECRET
```

## Backup / Restore

### PostgreSQL (logical)

Backup:

```bash
mkdir -p backups
docker compose -f deployments/prod/docker-compose.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-crystalith}" "${POSTGRES_DB:-crystalith}" \
  > backups/postgres.sql
```

Restore:

```bash
cat backups/postgres.sql | docker compose -f deployments/prod/docker-compose.yml exec -T postgres \
  psql -U "${POSTGRES_USER:-crystalith}" -d "${POSTGRES_DB:-crystalith}"
```

### Volumes (Chroma / uploads)

If you prefer volume-level backups:

```bash
mkdir -p backups
docker run --rm -v chromadata:/data -v "$(pwd)/backups:/backups" alpine \
  tar -czf /backups/chromadata.tgz -C /data .
docker run --rm -v api_data:/data -v "$(pwd)/backups:/backups" alpine \
  tar -czf /backups/api_data.tgz -C /data .
```
