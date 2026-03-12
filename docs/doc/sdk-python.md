# Python SDK

## Overview
The Python SDK is generated from the backend OpenAPI schema via Fern and stored in:

- `vendor/crystalith-sdks/python` (git submodule)

The import package lives under:
- `vendor/crystalith-sdks/python/src/crystalith_sdk`

Fern configuration lives in:
- `sdk/configs/fern/fern.config.json`
- `sdk/configs/fern/generators.yml`

## Versioning
- SDK version is sourced from `backend/py/pyproject.toml` and written to `vendor/crystalith-sdks/python/.sdk-version` during generation.
- You can override with `just sdk-gen-python VERSION=X.Y.Z`, but it must match the backend version.

## Install

```bash
pip install crystalith-sdk
```

## Minimal example

Base URL (no `/v1`):
- Local dev (`cd backend/py && just dev`): `http://127.0.0.1:8032`
- Docker Compose (same entrypoint as Web UI): `http://localhost:${CL_WEB_PORT:-8080}`

Note: Port `8000` is typically an optional dependency (e.g. Chroma), not the Crystalith API.
Auth (optional): if `app.auth.enabled=true`, send `Authorization: Bearer <token>` (or `X-API-Key: <token>`).

```python
import os

from crystalith_sdk import CrystalithClient

api_key = os.environ.get("CRYSTALITH_API_KEY")
headers = {"Authorization": f"Bearer {api_key}"} if api_key else None

client = CrystalithClient(base_url="http://127.0.0.1:8032", headers=headers)

notebooks = client.notebooks.list_notebooks()
notebook = client.notebooks.create_notebook(name="Demo")

with open("example.pdf", "rb") as f:
    client.sources.upload_source(notebook.id, file=("example.pdf", f))

qa = client.qa.ask_question(notebook.id, question="Summarize the uploaded source.")
print(qa.answer)

output = client.outputs.create_output(notebook.id, "BRIEFING")
print(output.id, output.type)
```

## CI constraints

- `frontend/web/openapi.gen.json` must stay in sync with the backend schema (CI runs `uv run scripts/api_schema.py check`).
- Generated API clients must be committed (CI runs `pnpm run api:generate` and checks for diff).
- The Python SDK must build and its version must match the backend (CI runs `just sdk-version-check` + `just sdk-build-python`).

## Automation

- GitHub Actions:
  - `Check Python SDK`: runs `just api-check` + `just sdk-version-check` + `just sdk-build-python`.
- Fern:
  - Local generation uses Fern CLI (`npm install -g fern-api@3.73.1`) and Docker (`fern generate --local`).
  - `FERN_TOKEN` / `fern login` is only required for remote generation.

## Local generation

```bash
# Ensure the SDK monorepo submodule is present
git submodule update --init --recursive vendor/crystalith-sdks

# Generate all SDKs (export schema + frontend + Python)
just sdk-gen

# Generate Python SDK only
just sdk-gen-python

# Check if Python SDK is up to date (for pre-commit)
just sdk-check

# Build Python SDK (wheel/sdist)
just sdk-build-python

# Check versions match backend (Python + TypeScript)
just sdk-version-check
```

## Release workflow (PyPI)

Recommended: from the main `crystalith` repo, run:

```bash
just sdk-release X.Y.Z
```

Because the Python package lives inside the `crystalith-sdks` git submodule, publishing is triggered by a tag in the SDK monorepo:

- `python/vX.Y.Z` (in `crystalith-sdks`)

If you need to do it manually, the release flow is:

1. Generate + commit + push SDK changes in `crystalith-sdks`
2. Update the submodule pointer in `crystalith` (commit + push)
3. Run `just sdk-release-check`
4. Tag `python/vX.Y.Z` in `crystalith-sdks` and push the tag (triggers publish)

## Notes
- The generated README.md is owned by the Fern generator.
- Do not manually edit generated files; changes should be made in backend APIs.
- Fern may require login or `FERN_TOKEN` to generate SDKs.
