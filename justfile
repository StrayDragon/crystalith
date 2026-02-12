default:
    @just -l

SDK_PATH := "sdk/client/python"
SCHEMA_PATH := "frontend/web/openapi.json"

# --------------------------------------------------------------------------
# API Schema
# --------------------------------------------------------------------------

# Export latest API schema from backend
api-export:
    cd backend/py && uv run scripts/api_schema.py export -o ../../frontend/web/openapi.json

# Check if API schema is up to date (for CI/pre-commit)
api-check:
    cd backend/py && uv run scripts/api_schema.py check -s ../../frontend/web/openapi.json

# --------------------------------------------------------------------------
# SDK Generation
# --------------------------------------------------------------------------

# Generate frontend SDK (OpenAPI → TypeScript)
sdk-gen-web:
    cd frontend/web && pnpm run api:generate

# Sync frontend: export schema + regenerate frontend SDK
api-sync: api-export sdk-gen-web

# Generate Python SDK via Fern (version from backend/py/pyproject.toml)
sdk-gen-python VERSION='':
    #!/usr/bin/env bash
    set -euo pipefail
    BACKEND_VERSION=$(cd backend/py && python -c \
      'import re, pathlib; m = re.search(r"^version\s*=\s*\"([^\"]+)\"", pathlib.Path("pyproject.toml").read_text(), re.M); print(m.group(1)) if m else exit("version not found in backend/py/pyproject.toml")')
    SDK_VERSION="${VERSION:-$BACKEND_VERSION}"
    if [[ -n "{{VERSION}}" && "{{VERSION}}" != "$BACKEND_VERSION" ]]; then
      echo "SDK_VERSION ({{VERSION}}) must match backend version ($BACKEND_VERSION)" >&2; exit 1
    fi
    if [[ ! -f "{{SCHEMA_PATH}}" ]]; then
      echo "OpenAPI schema not found at {{SCHEMA_PATH}}. Run: just api-export" >&2; exit 1
    fi
    command -v fern >/dev/null 2>&1 || { echo "fern CLI not found. Install: pnpm install -g fern-api" >&2; exit 1; }
    (cd sdk/configs && fern generate --local --force --group python-sdk --version "$SDK_VERSION")
    if [[ ! -f "{{SDK_PATH}}/.fern/metadata.json" ]]; then
      echo "Fern metadata not found. Ensure generation succeeded." >&2; exit 1
    fi
    echo "$SDK_VERSION" > "{{SDK_PATH}}/.sdk-version"
    cp LICENSE "{{SDK_PATH}}/LICENSE"
    printf '# This directory is generated via Fern (just sdk-gen-python).\n# Do not edit manually.\n' > "{{SDK_PATH}}/.generated"
    echo "Python SDK v${SDK_VERSION} generated at {{SDK_PATH}}"

# Generate all SDKs: export schema → frontend SDK → Python SDK
sdk-gen VERSION='': api-export sdk-gen-web (sdk-gen-python VERSION)

# Check Python SDK is up to date (for pre-commit)
sdk-check: api-export (sdk-gen-python)
    git add {{SDK_PATH}}
    git diff --staged --exit-code

# --------------------------------------------------------------------------
# Testing
# --------------------------------------------------------------------------

# Run all tests
test: test-backend test-frontend

# Run backend tests only
test-backend:
    cd backend/py && just test

# Run frontend tests only
test-frontend:
    cd frontend/web && pnpm test

# --------------------------------------------------------------------------
# Misc
# --------------------------------------------------------------------------

# Run pre-commit checks
check-pre-commit-hooks:
    prek run --all-files
