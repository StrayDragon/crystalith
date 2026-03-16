# Getting Started

## Prerequisites

- Python 3.12 + [uv](https://docs.astral.sh/uv/)
- Node 20 + [pnpm](https://pnpm.io/)
- [just](https://just.systems/) (task runner)
- [overmind](https://github.com/DarthSim/overmind) (for `local` / `hybrid` profiles)
- Docker + Compose (for `hybrid` / `docker` / `full` profiles)

## 1. Initialize config

```bash
cp .env.example .env
just upsert-env-configs
```

`just upsert-env-configs` reads well-known env vars from your shell (e.g. `OPENAI_API_KEY`, `POSTGRES_PASSWORD`) and writes them into `.env` and `config/secrets.yaml`. Existing values are never overwritten.

If you prefer manual setup:

```bash
cp config/secrets.yaml.example config/secrets.yaml
# edit config/secrets.yaml — at minimum set OPENAI_API_KEY
```

## 2. Choose a profile

Edit `CRYSTALITH_PROFILE` in `.env`, or pass it directly:

| Profile | Command | What it does |
|---------|---------|-------------|
| `local` | `just up local` | overmind starts backend + frontend on host. No Docker. SQLite + embedded Chroma. |
| **`hybrid`** | `just up` (default) | Docker runs deps (Postgres, Chroma, Redis, SearXNG). Backend + frontend run on host with hot reload. |
| `docker` | `just up docker` | Docker Compose deploys app + selected deps. Remaining services connect externally. |
| `full` | `just up full` | Full Docker Compose with all optional overlays. |

## 3. Start

```bash
just up
```

Stop:

```bash
just down
```

Status / logs:

```bash
just status
just logs
```

## Configuration model

Crystalith is **YAML-first** for runtime configuration:

- `config/app.yaml` — main config (committable, safe defaults)
- `config/secrets.yaml` — secrets for `${{ secrets.VAR }}` interpolation (gitignored)
- `.env` — compose/build parameters + profile selection

Config overlays are auto-discovered and deep-merged:

```
config/app.yaml              ← base (committed)
config/app.local.yaml        ← local overrides (gitignored)
config/app.{env}.yaml        ← per-environment (CRYSTALITH_ENV)
config/app.{env}.local.yaml  ← environment + local
config/secrets.yaml          ← secrets
```

Endpoint candidates in `config/app.yaml` are automatically reordered based on runtime context — docker-internal names are preferred inside containers, localhost is preferred on the host. You don't need separate configs for different profiles.

## Provider setup

### OpenAI (direct)

Set `OPENAI_API_KEY` in your shell, then `just upsert-env-configs`. Or manually edit `config/secrets.yaml`.

### OpenAI-compatible endpoint (proxy / self-host)

```bash
export OPENAI_API_KEY="sk-..."
export OPENAI_BASE_URL="http://llm.internal:50256/v1"
just upsert-env-configs
```

If your gateway doesn't serve OpenAI embedding models:

```bash
export CRYSTALITH_DEFAULT_EMBEDDING_MODEL="bge-m3-openai"
```

For VPN/Tailscale endpoints in Docker mode, set `BRIDGE_FORWARDS` and `OPENAI_BASE_URL_DOCKER` in `.env` and add `host-remap` to `DOCKER_SERVICES`.

### Ollama (fully local)

1. Install Ollama at `http://localhost:11434`
2. Add `ollama` to `HYBRID_SERVICES` in `.env`
3. In `config/app.yaml`, switch defaults:

```yaml
models:
  defaults:
    chat: "qwen-local"
    embedding: "bge-m3-local"
```

## Customizing services per profile

In `.env`, control which services each profile includes:

```bash
CRYSTALITH_PROFILE=hybrid
HYBRID_SERVICES=storage redis searxng        # deps for hybrid mode
DOCKER_SERVICES=storage redis searxng        # overlays for docker mode
FULL_SERVICES=storage redis searxng ollama slidev
```

Available overlays: `storage`, `redis`, `searxng`, `ollama`, `slidev`, `host-remap`.

For mode C (Docker + external services), reduce `DOCKER_SERVICES` to only what you need in Docker, and let endpoint probing find your external services:

```bash
CRYSTALITH_PROFILE=docker
DOCKER_SERVICES=redis    # only Redis in Docker; Postgres/Chroma/etc. connect externally
```

## URLs

| Service | Dev (local/hybrid) | Docker |
|---------|-------------------|--------|
| Frontend | `http://127.0.0.1:3000` | `http://localhost:8080` |
| Backend API | `http://127.0.0.1:8032` | via Nginx at `:8080/v1/` |
| API docs (Scalar) | `http://127.0.0.1:8032/v1/codev/openapi-ui/scalar` | `http://localhost:8080/v1/codev/openapi-ui/scalar` |

## Workspace tips

- Command palette: `Ctrl+K`
- Shortcut help: `Ctrl+?`
- Mobile: narrow screens (<768px) switch to single-panel mode with bottom tab bar.
- Sources: upload `.txt`, `.md`, `.pdf` files, or use connectors (Obsidian Vault, Local Directory).
- Health / diagnostics: header button → `/health/dependencies`

## Dev workflow tips

- Backend tests: `cd backend/py && just test`
- Frontend tests: `cd frontend/web && pnpm test`
- OpenAPI changes: `just api-sync`
- Config schema: `cd backend/py && just config-schema`

## Multi-machine sync

Set env vars in your shell profile (`~/.bashrc`, `~/.zshrc`), then on any machine:

```bash
git clone <repo> && cd crystalith
just upsert-env-configs
just up
```

Recognized env vars: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `POSTGRES_PASSWORD`, `CRYSTALITH_API_KEY`, `JINA_API_KEY`, `FIRECRAWL_API_KEY`, `BROWSERLESS_TOKEN`, `CRYSTALITH_PROFILE`, `CRYSTALITH_DEFAULT_EMBEDDING_MODEL`, `BRIDGE_FORWARDS`.

## Next

- `Optimal Config` — profile comparison and YAML tuning knobs
- `Deployment` — compose overlays, GHCR images, production notes
- `Operations` — diagnostics and runbooks
