# Crystalith

[![PyPI](https://img.shields.io/pypi/v/crystalith-sdk?label=PyPI)](https://pypi.org/project/crystalith-sdk/)
[![npm](https://img.shields.io/npm/v/%40crystalith%2Fsdk?label=npm)](https://www.npmjs.com/package/@crystalith/sdk)

Notebook-centric AI workspace with RAG over your sources.

## Docs

- GitHub Pages: https://straydragon.github.io/crystalith/
- Source: `docs/`
- Local preview:
  - `uv sync --project docs`
  - `just docs-serve`
  - `just docs-build`

## Community

- Contributing: `CONTRIBUTING.md`
- Security: `SECURITY.md`
- Changelog: `CHANGELOG.md`
- License: `LICENSE` (Apache-2.0)

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
just composition-smoke
```
