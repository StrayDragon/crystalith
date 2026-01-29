# Python SDK

## Overview
The Python SDK is generated from the backend OpenAPI schema and stored in:

- `sdk/client/python`

It is generated via Fern and released manually via the GitHub Actions workflow.

Fern configuration lives in:
- `fern/fern.config.json`
- `fern/generators.yml`

Path customization:
- `SDK_PATH` environment variable can override the output directory in scripts and workflows.
- If you change the path, update `fern/generators.yml` to match.

## Versioning
- Tag format: `vX.Y.Z`
- SDK version: `X.Y.Z` (tag without the leading `v`)
- SDK version is sourced from `backend/py/pyproject.toml` and written to `sdk/client/python/.sdk-version` during generation.

## PyPI Trusted Publishing (OIDC)
1. Create a `pypi` GitHub environment and (optionally) add protection rules.
2. In PyPI, add a Trusted Publisher for project `crystalith`:
   - Owner: your GitHub org/user
   - Repository: this repo
   - Workflow: `.github/workflows/release-python-sdk.yml`
   - Environment: `pypi`
3. Add `PYPI_API_TOKEN` as a fallback secret (only used if OIDC publish fails).

## Usage (after `pip install crystalith`)

```python
from crystalith import CrystalithClient

client = CrystalithClient(base_url="https://your-host")
models = client.models.list_models()
```

## Local generation (manual)

```bash
# Generate SDK (version is read from backend/py/pyproject.toml)
just sdk-gen

# Check if SDK is up to date (use before commit)
just sdk-check
```

## Manual release
1. Generate SDK locally and commit `sdk/client/python`.
2. Trigger the `Release Python SDK` workflow manually.
3. Provide the SDK version input (e.g. `1.2.3`) and ensure it matches both `sdk/client/python/.sdk-version` and `backend/py/pyproject.toml`.

## Notes
- The generated README.md is owned by the generator.
- Do not manually edit generated files; changes should be made in backend APIs.
- `sdk-gen` enforces SDK version to match `backend/py/pyproject.toml` and writes `sdk/client/python/.sdk-version`.
- Fern may require login or `FERN_TOKEN` to generate SDKs.
