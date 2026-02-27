_default:
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
    command -v fern >/dev/null 2>&1 || { echo "fern CLI not found. Install: npm install -g fern-api@3.73.1" >&2; exit 1; }
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

# Run fast repository guardrails (no full test suite)
check:
    @echo "==> Backend guardrails"
    cd backend/py && just check
    @echo "==> OpenAPI schema consistency"
    just api-check
    @echo "==> Frontend generated API client consistency"
    cd frontend/web && pnpm run api:generate
    git diff --exit-code -- frontend/web/src/api/generated

# Run all tests
test: check test-backend test-frontend

# Run backend tests only
test-backend:
    cd backend/py && just test

# Run frontend tests only
test-frontend:
    cd frontend/web && pnpm test

# --------------------------------------------------------------------------
# Docs
# --------------------------------------------------------------------------

# Serve docs site (Zensical)
docs-serve *ARGS='':
    #!/usr/bin/env bash
    set -euo pipefail
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 && "${EXTRA_ARGS[0]}" == "--" ]]; then
      EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
    fi
    uv run --project docs zensical serve -f mkdocs.yml "${EXTRA_ARGS[@]}"

# Build docs site (Zensical)
docs-build *ARGS='':
    #!/usr/bin/env bash
    set -euo pipefail
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 && "${EXTRA_ARGS[0]}" == "--" ]]; then
      EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
    fi
    uv run --project docs zensical build -f mkdocs.yml "${EXTRA_ARGS[@]}"

# --------------------------------------------------------------------------
# Dev Compose (developer defaults)
#
# Default overlays: storage + redis.
# Available overlays: storage redis ollama slidev host-remap
# Example:
#   just DEV_OPTIONALS="storage redis ollama" dev-docker-up
# --------------------------------------------------------------------------

COMPOSE_CORE_FILE := "deployments/prod/docker-compose.yml"
DEV_OPTIONALS := "storage redis"
CHINA_APT_MIRROR := "https://mirrors.tuna.tsinghua.edu.cn/debian"
CHINA_UV_INDEX_URL := "https://mirrors.aliyun.com/pypi/simple/"
CHINA_NPM_REGISTRY := "https://registry.npmmirror.com"

dev-docker-up *ARGS='':
    #!/usr/bin/env bash
    set -euo pipefail
    FILES=(-f {{COMPOSE_CORE_FILE}})
    for optional in {{DEV_OPTIONALS}}; do
      FILES+=(-f "deployments/prod/docker-compose.${optional}.yml")
    done
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 && "${EXTRA_ARGS[0]}" == "--" ]]; then
      EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
    fi
    APT_MIRROR="${APT_MIRROR:-{{CHINA_APT_MIRROR}}}" \
    UV_INDEX_URL="${UV_INDEX_URL:-{{CHINA_UV_INDEX_URL}}}" \
    NPM_REGISTRY="${NPM_REGISTRY:-{{CHINA_NPM_REGISTRY}}}" \
    docker compose --env-file .env "${FILES[@]}" up -d --build "${EXTRA_ARGS[@]}"

dev-docker-down *ARGS='':
    #!/usr/bin/env bash
    set -euo pipefail
    FILES=(-f {{COMPOSE_CORE_FILE}})
    for optional in {{DEV_OPTIONALS}}; do
      FILES+=(-f "deployments/prod/docker-compose.${optional}.yml")
    done
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 && "${EXTRA_ARGS[0]}" == "--" ]]; then
      EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
    fi
    docker compose --env-file .env "${FILES[@]}" down "${EXTRA_ARGS[@]}"

dev-docker-ps:
    #!/usr/bin/env bash
    set -euo pipefail
    FILES=(-f {{COMPOSE_CORE_FILE}})
    for optional in {{DEV_OPTIONALS}}; do
      FILES+=(-f "deployments/prod/docker-compose.${optional}.yml")
    done
    docker compose --env-file .env "${FILES[@]}" ps

dev-docker-logs *ARGS='':
    #!/usr/bin/env bash
    set -euo pipefail
    FILES=(-f {{COMPOSE_CORE_FILE}})
    for optional in {{DEV_OPTIONALS}}; do
      FILES+=(-f "deployments/prod/docker-compose.${optional}.yml")
    done
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 && "${EXTRA_ARGS[0]}" == "--" ]]; then
      EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
    fi
    docker compose --env-file .env "${FILES[@]}" logs -f "${EXTRA_ARGS[@]}"

dev-docker-rebuild SERVICE:
    #!/usr/bin/env bash
    set -euo pipefail
    FILES=(-f {{COMPOSE_CORE_FILE}})
    for optional in {{DEV_OPTIONALS}}; do
      FILES+=(-f "deployments/prod/docker-compose.${optional}.yml")
    done
    APT_MIRROR="${APT_MIRROR:-{{CHINA_APT_MIRROR}}}" \
    UV_INDEX_URL="${UV_INDEX_URL:-{{CHINA_UV_INDEX_URL}}}" \
    NPM_REGISTRY="${NPM_REGISTRY:-{{CHINA_NPM_REGISTRY}}}" \
    docker compose --env-file .env "${FILES[@]}" up -d --build --no-deps {{SERVICE}}

dev-docker-smoke:
    #!/usr/bin/env bash
    set -euo pipefail
    PORT="${CL_WEB_PORT:-8080}"
    echo "=== Health ==="
    curl -fsS "http://localhost:$PORT/health"
    echo
    echo "=== Models ==="
    curl -fsS "http://localhost:$PORT/v1/models" | python3 -m json.tool | head -10
    echo "..."
    echo "=== Dependencies ==="
    curl -fsS "http://localhost:$PORT/health/dependencies" | python3 -m json.tool | head -20
    echo
    echo "All checks passed."

composition-smoke:
    ./scripts/composition_smoke.sh

# --------------------------------------------------------------------------
# Misc
# --------------------------------------------------------------------------

# Run pre-commit checks
check-pre-commit-hooks:
    prek run --all-files
