# Operations (Self-host)

This page focuses on day‑2 operability for self‑hosted Crystalith: diagnostics, backup/restore, and a quick runbook.

## Security

- By default, the API is **unauthenticated**. Enable `app.auth` (or add a reverse-proxy auth layer) before exposing your stack to the public internet.
- When `app.auth.enabled=true`, all `/v1/**` endpoints require an API key (Bearer token). `/health` and `/health/dependencies` remain anonymous for probes.

## Diagnostics

- UI: use the Workspace **Health / Diagnostics** dialog (header button).
- API:
  - `GET /health`
  - `GET /health/dependencies` (core + optional services, with `recovery_hint`)

## Backup / Restore / Migration

Crystalith deployments are typically **core + optional overlays**. The minimal backup set depends on which storage mode you run.

### Core-only (local SQLite + embedded vector store)

In the default core compose, the host `./data` directory is mounted into the API container at `/app/data`.

Minimal backup set:
- `config/app.yaml` (configuration)
- `data/app.db` (SQLite database)
- Vector store data (depends on config):
  - Embedded Chroma: `data/chroma/`
  - SQLite vectors: `data/vectors.db`

Optional (nice-to-have):
- `data/output/` (generated artifacts/previews)
- `config/secrets.yaml` (if present; do not commit it) or any path referenced by `CRYSTALITH_SECRETS_PATH`

Restore steps (core-only):
1. Stop the stack: `docker compose ... down`
2. Restore the files above to the target host.
3. Start the stack: `docker compose ... up -d`
4. Verify:
   - `curl -fsS http://localhost:${CL_WEB_PORT:-8080}/health`
   - Open the UI and confirm notebooks/sources are present.

### storage overlay (Postgres + Chroma server)

When using `deployments/prod/docker-compose.storage.yml`, persistence moves into Docker volumes:
- Postgres: `pgdata`
- Chroma: `chromadata`

Minimal backup set (storage overlay):
- `config/app.yaml`
- Docker volumes: `pgdata`, `chromadata`

Tip: treat volume names as **compose‑project scoped**. Use `docker volume ls | rg crystalith` to confirm exact names on your host.

### redis overlay

If enabled, Redis data is stored in the `redisdata` volume. Back it up only if you need cache persistence (most setups can skip it).

### ollama overlay

If enabled, downloaded models live in the `ollamadata` volume. Back it up if you want to avoid re-downloading models after migration.

## Runbook (common failures)

### UI is unreachable

Symptoms:
- Browser cannot open the UI, or you get a reverse‑proxy error.

Checks:
- `docker compose ps`
- `curl -v http://localhost:${CL_WEB_PORT:-8080}/health`

Fixes:
- Port conflict: change `CL_WEB_PORT` in `.env`.
- Container not running: check logs (`docker compose logs web api`).

### UI opens but backend shows “disconnected”

Checks:
- `curl -fsS http://localhost:${CL_WEB_PORT:-8080}/health`
- Open Workspace **Health / Diagnostics** and inspect `core.backend`.

Fixes:
- API container unhealthy: check `docker compose logs api`.
- Misconfigured env/config: confirm `config/app.yaml` is mounted and valid.

### Optional services are degraded / disabled

Checks:
- UI diagnostics panel shows `optional.*` status + `recovery_hint`.
- `curl -fsS http://localhost:${CL_WEB_PORT:-8080}/health/dependencies | python3 -m json.tool | head -120`

Fixes:
- If you intended to use an overlay, ensure you started it (compose `-f docker-compose.<overlay>.yml`).
- If using external services, verify `config/app.yaml`:
  - Postgres: `database.url` / `database.url_candidates` (+ secrets for password)
  - Chroma: `vector_storage.chroma.host/port` or `vector_storage.chroma.endpoint_candidates`
  - Redis: `cache.provider` + `cache.redis_url` / `cache.redis_url_candidates`
  - Ollama: `optional_services.ollama.endpoint_candidates` (and ollama model provider host)
  - SearXNG: `search.searxng.host` / `search.searxng.endpoint_candidates`

### “Source from URL” fails (SSRF protections)

Symptoms:
- Fetch mode rejects a URL (often private IPs, localhost, or metadata targets).

Fix:
- Use a public `http(s)` URL, or explicitly allowlist controlled hosts in `config/app.yaml`:
  - `source_ingestion.url_fetch.security.allowlist_hosts`
  - `source_ingestion.url_fetch.security.allowlist_domains`
  - `source_ingestion.url_fetch.security.allowlist_cidrs`

Security note: keep allowlists tight; avoid enabling `allowlist_only` unless you understand the trade‑off.
