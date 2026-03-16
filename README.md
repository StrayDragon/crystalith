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

## Quick start

```bash
cp .env.example .env
just upsert-env-configs       # fill secrets from shell env vars
just up                       # start with default profile (hybrid)
```

Four profiles, one command:

| Profile | Command | Description |
|---------|---------|-------------|
| `local` | `just up local` | No Docker, SQLite + embedded Chroma |
| `hybrid` | `just up` | Docker deps + host hot reload (recommended) |
| `docker` | `just up docker` | Docker Compose deploy + optional external services |
| `full` | `just up full` | Full Docker Compose deployment |

No-docker backend only (SQLite + embedded Chroma):

```bash
cd backend/py
uv sync
just db-init
just dev
```

Frontend only:

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

## Maintenance

```bash
just cleanup              # dry-run: detect stale artifacts
just cleanup --apply      # execute cleanup
```

Profiles / tuning: see `docs/doc/optimal-config.md`.
