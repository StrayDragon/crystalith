# Crystalith

Notebook-centric AI workspace with RAG over your sources.

## Docs

- GitHub Pages: https://straydragon.github.io/crystalith/
- Source: `docs/`
- Local preview:
  - `uv sync --project docs`
  - `just docs-serve`
  - `just docs-build`

## Quick start (local dev)

Backend:

```bash
cd backend/py
uv sync
just db-init
just dev
```

Frontend:

```bash
cd frontend/web
pnpm install
pnpm dev
```

## Quick start (Docker Compose)

```bash
cp .env.example .env
just dev-docker-up
```
