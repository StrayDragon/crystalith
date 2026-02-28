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

## Minimal example

```python
from crystalith import CrystalithClient

client = CrystalithClient(base_url="http://localhost:8000")

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

- `frontend/web/openapi.json` must stay in sync with the backend schema (CI runs `uv run scripts/api_schema.py check`).
- Generated API clients must be committed (CI runs `pnpm run api:generate` and checks for diff).

## Automation

- GitHub Actions:
  - `Check Python SDK`: runs `just api-check` + `just sdk-check`.
- Fern:
  - CI pins Fern CLI (`fern-api@3.73.1`).
  - Generation may require `FERN_TOKEN` (local or CI secret).

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
