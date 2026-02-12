# Deployments

This directory is the canonical entrypoint for deployment configs.

## Production (recommended)

From repo root:

```bash
cp .env.example .env
docker compose --env-file .env -f deployments/prod/docker-compose.yml up -d --build
```

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
