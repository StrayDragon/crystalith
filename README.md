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

Recommended (host hot reload + docker deps):

```bash
cp .env.example .env
cp config/secrets.yaml.example config/secrets.yaml
# edit config/secrets.yaml (OPENAI_API_KEY)
just dev
```

Profiles / tuning: see `docs/content/optimal-config.md`.

No-docker (SQLite + embedded Chroma):

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

Optional Slidev preview during host dev:

```bash
just dev-slidev
```

Notes:
- Frontend dev/build/test commands auto-initialize `frontend/web/vendor/rivu` when needed.
- Manual fallback: `just rivu-submodule-update`

## Quick start (Docker Compose, prod-like)

```bash
cp .env.example .env
cp config/secrets.yaml.example config/secrets.yaml
# edit config/secrets.yaml (OPENAI_API_KEY, POSTGRES_PASSWORD if using storage overlay)
just dev-docker-up
just composition-smoke
```

Optional Slidev overlay:

```bash
just DEV_OPTIONALS="storage redis searxng ollama slidev" dev-docker-up
```
