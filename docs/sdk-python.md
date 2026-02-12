# Python SDK

## Overview
The Python SDK is generated from the backend OpenAPI schema via Fern and stored in:

- `sdk/client/python`

Fern configuration lives in:
- `sdk/configs/fern/fern.config.json`
- `sdk/configs/fern/generators.yml`

## Versioning
- SDK version is sourced from `backend/py/pyproject.toml` and written to `sdk/client/python/.sdk-version` during generation.
- You can override with `just sdk-gen-python VERSION=X.Y.Z`, but it must match the backend version.

## Usage (after `pip install crystalith`)

```python
from crystalith import CrystalithClient

client = CrystalithClient(base_url="https://your-host")
models = client.models.list_models()
```

## CI constraints

- `frontend/web/openapi.json` must stay in sync with the backend schema (CI runs `uv run scripts/api_schema.py check`).
- Generated API clients must be committed (CI runs `pnpm run api:generate` and checks for diff).

## Local generation

```bash
# Generate all SDKs (export schema + frontend + Python)
just sdk-gen

# Generate Python SDK only
just sdk-gen-python

# Check if Python SDK is up to date (for pre-commit)
just sdk-check
```

## Notes
- The generated README.md is owned by the Fern generator.
- Do not manually edit generated files; changes should be made in backend APIs.
- Fern may require login or `FERN_TOKEN` to generate SDKs.
