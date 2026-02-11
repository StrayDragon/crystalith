# Deployments

This directory is the canonical entrypoint for deployment configs.

## Production (recommended)

From repo root:

```bash
cp .env.example .env
docker compose --env-file .env -f deployments/prod/docker-compose.yml up -d --build
```

## Root compatibility entrypoint

`docker-compose.prod.yml` is kept for compatibility with older docs/scripts. It is generated from `deployments/prod/docker-compose.yml`.

```bash
cp .env.example .env
python scripts/deploy/sync_prod_compose.py
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

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
```

