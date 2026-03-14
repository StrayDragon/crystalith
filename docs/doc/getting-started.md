# Getting Started

## Prerequisites

- Docker (recommended)
- Python 3.12 + `uv`
- Node 20 + `pnpm`
- `just` (task runner)

## Configuration model (important)

Crystalith is **YAML-first** for runtime/business configuration:

- Runtime config: `config/app.yaml` (committable)
- Secrets (do not commit): `config/secrets.yaml` (auto-discovered) or `CRYSTALITH_SECRETS_PATH`
- Compose/build parameters: `.env` (ports/images/mirrors) + optional non-secret runtime hints (e.g. `OPENAI_BASE_URL_DOCKER`)

Legacy runtime env overrides (e.g. `DATABASE_URL`, `OPENAI_API_KEY`, `REDIS_URL`) are intentionally **not** used.

## Provider setup (choose one)

### Option A: OpenAI (direct)

1) Create a local secrets file:

```bash
cp config/secrets.yaml.example config/secrets.yaml
# edit config/secrets.yaml and set OPENAI_API_KEY
```

2) Leave `OPENAI_BASE_URL` empty/unset to use the OpenAI SDK default (`https://api.openai.com/v1`).

```yaml
providers:
  openai_default: &openai_default
    base_url: "${{ env.OPENAI_BASE_URL }}"
```

### Option B: OpenAI-compatible endpoint (proxy / self-host)

1) Put your API key in `config/secrets.yaml` (`OPENAI_API_KEY`).
2) Set `OPENAI_BASE_URL` to your endpoint (host env / compose env):

```bash
export OPENAI_BASE_URL="http://llm.internal:50256/v1"
```

If your gateway does not provide OpenAI embedding models (e.g. `text-embedding-3-*`), set:

```bash
export CRYSTALITH_DEFAULT_EMBEDDING_MODEL="bge-m3-openai"
```

If the endpoint is only reachable from your host network (VPN / Tailscale), use the `host-remap` overlay in
**Docker Compose (prod-like)**:

- Set `BRIDGE_FORWARDS` in `.env` (example): `BRIDGE_FORWARDS="50256:llm.internal:50256"`
- Set `OPENAI_BASE_URL_DOCKER` in `.env` (example): `OPENAI_BASE_URL_DOCKER="http://host.docker.internal:50256/v1"`
- If your gateway does not provide OpenAI embedding models, set `CRYSTALITH_DEFAULT_EMBEDDING_MODEL_DOCKER` (example): `CRYSTALITH_DEFAULT_EMBEDDING_MODEL_DOCKER="bge-m3-openai"`
- Start with: `just DEV_OPTIONALS="storage redis searxng host-remap" dev-docker-up`

### Option C: Ollama (fully local, no API key)

1) Install Ollama and ensure it’s reachable at `http://localhost:11434`.
2) Enable it in dev deps (optional): `just DEV_DEPS_OPTIONALS="storage redis searxng ollama" dev`
3) In `config/app.yaml`, switch defaults to local models:

```yaml
models:
  defaults:
    chat: "qwen-local"
    embedding: "bge-m3-local"
```

## Recommended dev (host hot reload + docker deps)

Starts Postgres + Chroma + Redis + SearXNG in Docker, and runs the backend + frontend on your host machine.

```bash
cp .env.example .env
cp config/secrets.yaml.example config/secrets.yaml
# configure a provider (see Provider setup above)
just dev
```

Optional deps:

```bash
# Minimal deps (no web search):
just DEV_DEPS_OPTIONALS="storage redis" dev

# Add local Ollama:
just DEV_DEPS_OPTIONALS="storage redis searxng ollama" dev
```

URLs:

- Frontend (Vite): `http://127.0.0.1:3000`
- Backend (FastAPI): `http://127.0.0.1:8032`
- API docs (Scalar): `http://127.0.0.1:8032/v1/codev/openapi-ui/scalar`

Stop / cleanup:

```bash
# Stop deps containers created by just dev
just dev-deps-down

# Tail deps logs
just dev-deps-logs
```

## No-docker dev (SQLite + embedded Chroma)

### Backend (FastAPI)

```bash
cd backend/py
uv sync
just db-init
just dev
```

API docs (Scalar): `http://127.0.0.1:8032/v1/codev/openapi-ui/scalar`

### Frontend (Vite + React)

```bash
cd frontend/web
pnpm install
pnpm dev
```

Optional Slidev preview service for slides workflow development:

```bash
just dev-slidev
```

Notes:
- Frontend dev/build/test/typecheck commands auto-initialize `frontend/web/vendor/rivu` when needed.
- The local Slidev preview service listens on `http://localhost:3030`.

## Workspace tips

- Command palette: `Ctrl+K`
- Shortcut help: `Ctrl+?`
- Sources:
  - Upload: `.txt`, `.md`, `.markdown`, or `.pdf` files in the Sources panel.
  - Connectors: Obsidian Vault + Local Directory (requires installing connector plugins, e.g. `crystalith[official-connectors]` or `crystalith[official-full]`).
    - Local dev: `cd backend/py && uv sync --extra official-connectors`
    - Docker Compose: set `.env` `CRYSTALITH_BACKEND_EXTRAS="official-connectors"` (or `official-full`) and rebuild the backend image.
    - Note: filesystem-based connectors read from the backend process filesystem; mount host directories into the API container and use the container path.
- Health / diagnostics: use the header button to inspect `/health/dependencies`

## Dev workflow tips

- Backend tests: `cd backend/py && just test`
- Frontend tests: `cd frontend/web && pnpm test`
- If backend OpenAPI changes:
  - Sync schema + regenerate client: `pnpm -C frontend/web run api:sync`
  - Or from repo root: `just api-sync`

## Docker Compose (prod-like)

This mode runs `web` (Nginx) + `api` (FastAPI) in containers and mounts `./config` and `./data`.

```bash
cp .env.example .env
cp config/secrets.yaml.example config/secrets.yaml
# edit config/secrets.yaml (OPENAI_API_KEY, POSTGRES_PASSWORD if using storage overlay)
just dev-docker-up
just dev-docker-smoke
```

Customize overlays (optional deps):

```bash
# Core only:
just DEV_OPTIONALS="" dev-docker-up

# Full local stack:
just DEV_OPTIONALS="storage redis searxng ollama slidev" dev-docker-up
```

Notes:
- If pulling images from GHCR is slow, you can temporarily use `HTTPS_PROXY=http://127.0.0.1:20171 docker pull ...`.
- Repo build helpers such as `just dev-docker-up`, `just dev-docker-rebuild`, and `./scripts/composition_smoke.sh` clear proxy env vars before Docker builds to avoid slow mirror routing.

Next:

- `Optimal Config` for recommended profiles
- `Deployment` for compose overlays and production notes
- `Operations` for diagnostics and runbooks
