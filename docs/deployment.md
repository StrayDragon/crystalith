# Deployment (Docker Compose)

The canonical production Compose stack lives in `deployments/prod/docker-compose.yml`.

For compatibility with older docs/scripts, `docker-compose.prod.yml` is generated from `deployments/prod/docker-compose.yml`.

## Quick Start (recommended)

```bash
cp .env.example .env
docker compose --env-file .env -f deployments/prod/docker-compose.yml up -d --build
```

Then open:

- Web UI: `http://localhost:${CL_WEB_PORT:-8080}`
- Backend health: `http://localhost:${CL_WEB_PORT:-8080}/health`
- API docs: `http://localhost:${CL_WEB_PORT:-8080}/v1/codev/openapi-ui/scalar`

## Root compatibility entrypoint

```bash
cp .env.example .env
python scripts/deploy/sync_prod_compose.py
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

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
```

## Notes

- `api` automatically runs Alembic migrations on startup (`AUTO_DB_INIT=1`).
- Data is persisted via Docker volumes (`pgdata`, `chromadata`, `api_data`).
- Redis is optional; enable it with:

```bash
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

The `api` service includes `extra_hosts: host.docker.internal:host-gateway` so containers can reach host services on Linux.

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
