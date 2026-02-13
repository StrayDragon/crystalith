# Deployments

This directory is the canonical entrypoint for deployment configs.

## Quick Start

```bash
cp .env.example .env              # edit .env with your settings
just docker-compose-up            # build & start all services
```

Or without `just`:

```bash
docker compose --env-file .env -f deployments/prod/docker-compose.yml up -d --build
```

Open http://localhost:8080 in your browser.

## Services Overview

| Service | Port | Description |
|---------|------|-------------|
| **web** (Nginx) | 8080 | Frontend SPA + API reverse proxy |
| **api** (FastAPI) | — | Backend API (internal, proxied by Nginx) |
| **slidev** | 3030 | Slide presentation preview (iframe) |
| **postgres** | — | Database (internal) |
| **chromadb** | — | Vector storage (internal) |
| **host-remap** | — | Optional port forwarder for VPN/Tailscale (profile: `host-remap`) |
| **redis** | — | Optional cache (profile: `redis`) |
| **ollama** | — | Optional local LLM (profile: `ollama`) |

## Just Commands

By default, `host-remap` profile is enabled (for VPN/Tailscale users).
Override with `PROFILES`:

```bash
just docker-compose-up                          # Start all (default: host-remap profile)
just PROFILES="" docker-compose-up              # Start without optional profiles
just PROFILES="host-remap ollama" docker-compose-up  # Custom profiles
just docker-compose-down                        # Stop all services
just docker-compose-ps                          # Show container status
just docker-compose-logs                        # Follow logs (all services)
just docker-compose-logs api                    # Follow logs (specific service)
just docker-compose-rebuild api                 # Rebuild & restart a single service
just docker-compose-smoke-test                  # Run smoke tests
```

## Host Remap (VPN / Tailscale Users)

If your AI services or search engine are on a VPN, Tailscale, or other networks
that Docker bridge networking cannot reach directly, enable the `host-remap` profile:

```bash
just docker-compose-up    # host-remap is enabled by default
```

Configure port forwards in `.env`:

```bash
# Format: LOCAL_PORT:REMOTE_HOST:REMOTE_PORT (space-separated)
BRIDGE_FORWARDS=50201:my-server.ts.net:50201 50256:my-server.ts.net:50256

# Other containers reach forwarded ports via host.docker.internal:LOCAL_PORT
OPENAI_BASE_URL=http://host.docker.internal:50256/v1
```

The host-remap container runs with `network_mode: host` and uses `socat` to
forward traffic from the host's ports to remote endpoints.

## Acceptance (smoke test)

```bash
just docker-compose-smoke-test
```

Or manually:

```bash
curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/health"
curl -fsS "http://localhost:${CL_WEB_PORT:-8080}/v1/models"

curl -fsS -X POST "http://localhost:${CL_WEB_PORT:-8080}/v1/notebooks" \
  -H 'Content-Type: application/json' \
  -d '{"name":"smoke"}'
```

Note: the `refine` endpoint requires an AI provider (either set `OPENAI_API_KEY`, or enable the Ollama profile below).

## Offline (optional): Ollama profile

This starts an `ollama` container (no ports exposed) and switches the backend defaults to the existing local model ids:

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

## Registry pull proxy (optional)

If pulling images from registries times out, pre-pull them with a local proxy and then run the build without proxy.

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
  alpine:3.21 \
; do docker pull "$img"; done

# Important: unset proxy before building; use China mirrors instead (below).
unset HTTPS_PROXY HTTP_PROXY ALL_PROXY
```

## China mirrors (optional)

If Docker builds time out in mainland China, you can override build-time package mirrors via env vars in `.env`:

```bash
APT_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/debian \
UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/ \
NPM_REGISTRY=https://registry.npmmirror.com \
docker compose --env-file .env -f deployments/prod/docker-compose.yml up -d --build
```

Notes:

- Mirrors are optional; defaults use upstream official sources.
- The backend Dockerfile only rewrites `deb.debian.org/debian` (it does not rewrite the Debian security repository).
