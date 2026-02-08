# Deployment (Docker Compose)

This repo ships a production-focused Compose stack in `docker-compose.prod.yml`.

## Quick Start

```bash
cp .env.example .env
docker compose -f docker-compose.prod.yml up -d --build
```

Then open:

- Web UI: `http://localhost:${CL_WEB_PORT:-8080}`
- Backend health: `http://localhost:${CL_WEB_PORT:-8080}/health`
- API docs: `http://localhost:${CL_WEB_PORT:-8080}/v1/codev/openapi-ui/scalar`

## Notes

- `api` automatically runs Alembic migrations on startup (`AUTO_DB_INIT=1`).
- Data is persisted via Docker volumes (`pgdata`, `chromadata`, `api_data`).
- Redis is optional; enable it with:

```bash
docker compose -f docker-compose.prod.yml --profile redis up -d
```

## Configuration

Copy `.env.example` to `.env` and edit as needed:

- `CL_WEB_PORT`: Public web port (default `8080`)
- `DATABASE_URL`: SQLAlchemy URL for PostgreSQL (async)
- `CACHE_PROVIDER` / `REDIS_URL`: Optional cache provider
- `OPENAI_API_KEY` / `OPENAI_BASE_URL`: Optional OpenAI-compatible provider
- `OLLAMA_HOST`: Optional Ollama host URL (example: `http://host.docker.internal:11434`)
- `CRYSTALITH_DEFAULT_CHAT_MODEL`: Override `models.defaults.chat` (must match an ID in `config/app.yaml`)
- `CRYSTALITH_DEFAULT_EMBEDDING_MODEL`: Override `models.defaults.embedding` (must match an ID in `config/app.yaml`)
- `CRYSTALITH_SECRETS_PATH`: Optional secrets file/dir (see below)

The `api` service includes `extra_hosts: host.docker.internal:host-gateway` so containers can reach host services on Linux.

### Ollama access (Linux)

If Ollama only listens on `127.0.0.1:11434`, Docker containers cannot reach it. Prefer running Ollama on all interfaces:

```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

Then set `OLLAMA_HOST=http://host.docker.internal:11434` in `.env`.

## Docker Secrets (Optional)

`CRYSTALITH_SECRETS_PATH` can point to either:

- a YAML file (mapping of `KEY: value`), or
- a directory (Docker secrets style: one file per key)

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
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-crystalith}" "${POSTGRES_DB:-crystalith}" \
  > backups/postgres.sql
```

Restore:

```bash
cat backups/postgres.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
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
