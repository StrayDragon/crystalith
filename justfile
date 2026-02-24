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

# Run all tests
test: test-backend test-frontend

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
# Docker Deployment
#
# Default PROFILES can be overridden:
#   just docker-compose-up                       # uses default profiles
#   just PROFILES="" docker-compose-up            # no optional profiles
#   just PROFILES="host-remap ollama" docker-compose-up  # custom profiles
# --------------------------------------------------------------------------

COMPOSE_FILE := "deployments/prod/docker-compose.yml"
# Default profiles to enable (space-separated). Override with: just PROFILES="..." <cmd>
PROFILES := "host-remap"

_compose_profiles := if PROFILES == "" { "" } else { replace(trim(PROFILES), " ", " --profile ") }
_compose_profile_flags := if _compose_profiles == "" { "" } else { "--profile " + _compose_profiles }
COMPOSE_BASE := "docker compose --env-file .env -f " + COMPOSE_FILE + " " + _compose_profile_flags

# Start all services (build if needed)
docker-compose-up *ARGS='':
    {{COMPOSE_BASE}} up -d --build {{ARGS}}

# Stop all services
docker-compose-down *ARGS='':
    {{COMPOSE_BASE}} down {{ARGS}}

# Show running container status
docker-compose-ps:
    {{COMPOSE_BASE}} ps

# Follow logs (all services or specific: just docker-compose-logs api)
docker-compose-logs *ARGS='':
    {{COMPOSE_BASE}} logs -f {{ARGS}}

# Rebuild and restart a specific service (e.g., just docker-compose-rebuild api)
docker-compose-rebuild SERVICE:
    {{COMPOSE_BASE}} up -d --build --no-deps {{SERVICE}}

# Smoke test: verify all endpoints
docker-compose-smoke-test:
    #!/usr/bin/env bash
    set -euo pipefail
    PORT="${CL_WEB_PORT:-8080}"
    echo "=== Health ==="
    curl -fsS "http://localhost:$PORT/health"
    echo
    echo "=== Models ==="
    curl -fsS "http://localhost:$PORT/v1/models" | python3 -m json.tool | head -10
    echo "..."
    echo "=== Slidev ==="
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3030/")
    echo "Slidev: HTTP $STATUS"
    echo
    echo "All checks passed."

# --------------------------------------------------------------------------
# Misc
# --------------------------------------------------------------------------

# Run pre-commit checks
check-pre-commit-hooks:
    prek run --all-files
