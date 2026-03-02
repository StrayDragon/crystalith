_default:
    @just -l

SDK_ROOT := "vendor/crystalith-sdks/python"
SDK_PACKAGE_PATH := "vendor/crystalith-sdks/python/src/crystalith_sdk"
SDK_TS_ROOT := "vendor/crystalith-sdks/typescript"
SDK_GO_ROOT := "vendor/crystalith-sdks/go"
SDK_RUST_ROOT := "vendor/crystalith-sdks/rust"
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
    git submodule update --init --recursive vendor/crystalith-sdks
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
    if [[ ! -f "{{SDK_PACKAGE_PATH}}/.fern/metadata.json" ]]; then
      echo "Fern metadata not found. Ensure generation succeeded." >&2; exit 1
    fi
    echo "$SDK_VERSION" > "{{SDK_ROOT}}/.sdk-version"
    cp LICENSE "{{SDK_ROOT}}/LICENSE"
    printf '# The Python package under src/crystalith_sdk is generated via Fern (just sdk-gen-python).\n# Do not edit generated files manually.\n' > "{{SDK_ROOT}}/.generated"
    touch "{{SDK_PACKAGE_PATH}}/py.typed"
    (cd "{{SDK_ROOT}}" && uv version "$SDK_VERSION" --frozen)
    echo "Python SDK v${SDK_VERSION} generated at {{SDK_PACKAGE_PATH}}"

# Generate Go SDK via Fern (version from backend/py/pyproject.toml)
sdk-gen-go VERSION='':
    #!/usr/bin/env bash
    set -euo pipefail
    git submodule update --init --recursive vendor/crystalith-sdks
    BACKEND_VERSION="$(python -c 'import tomllib, pathlib; print(tomllib.loads(pathlib.Path("backend/py/pyproject.toml").read_text())["project"]["version"])')"
    SDK_VERSION="${VERSION:-$BACKEND_VERSION}"
    if [[ -n "{{VERSION}}" && "{{VERSION}}" != "$BACKEND_VERSION" ]]; then
      echo "SDK_VERSION ({{VERSION}}) must match backend version ($BACKEND_VERSION)" >&2; exit 1
    fi
    if [[ ! -f "{{SCHEMA_PATH}}" ]]; then
      echo "OpenAPI schema not found at {{SCHEMA_PATH}}. Run: just api-export" >&2; exit 1
    fi
    command -v fern >/dev/null 2>&1 || { echo "fern CLI not found. Install: npm install -g fern-api@3.73.1" >&2; exit 1; }
    # Fern local generation does not forward GOPROXY/GOSUMDB into the generator container.
    # If proxy.golang.org is unreachable, patch the Docker image locally to use Go module mirrors.
    if [[ "${FERN_GO_SDK_PATCH_IMAGE:-auto}" != "0" ]]; then
      if [[ "${FERN_GO_SDK_PATCH_IMAGE:-auto}" == "1" ]] || ! curl -fsSL --max-time 3 https://proxy.golang.org >/dev/null 2>&1; then
        command -v docker >/dev/null 2>&1 || { echo "docker not found (needed for --local generation). Install Docker or use --runner podman and adjust the patch step." >&2; exit 1; }
        docker build -t fernapi/fern-go-sdk:1.26.0 -f sdk/generators/fern-go-sdk/Dockerfile sdk/generators/fern-go-sdk
      fi
    fi
    (cd sdk/configs && fern generate --local --force --group go-sdk --version "$SDK_VERSION")
    cp LICENSE "{{SDK_GO_ROOT}}/LICENSE"
    printf '# The Go module under vendor/crystalith-sdks/go is generated via Fern (just sdk-gen-go).\n# Do not edit generated files manually.\n' > "{{SDK_GO_ROOT}}/.generated"
    echo "Go SDK v${SDK_VERSION} generated at {{SDK_GO_ROOT}}"

# Generate Rust SDK via Fern (version from backend/py/pyproject.toml)
sdk-gen-rust VERSION='':
    #!/usr/bin/env bash
    set -euo pipefail
    git submodule update --init --recursive vendor/crystalith-sdks
    BACKEND_VERSION="$(python -c 'import tomllib, pathlib; print(tomllib.loads(pathlib.Path("backend/py/pyproject.toml").read_text())["project"]["version"])')"
    SDK_VERSION="${VERSION:-$BACKEND_VERSION}"
    if [[ -n "{{VERSION}}" && "{{VERSION}}" != "$BACKEND_VERSION" ]]; then
      echo "SDK_VERSION ({{VERSION}}) must match backend version ($BACKEND_VERSION)" >&2; exit 1
    fi
    if [[ ! -f "{{SCHEMA_PATH}}" ]]; then
      echo "OpenAPI schema not found at {{SCHEMA_PATH}}. Run: just api-export" >&2; exit 1
    fi
    command -v fern >/dev/null 2>&1 || { echo "fern CLI not found. Install: npm install -g fern-api@3.73.1" >&2; exit 1; }
    (cd sdk/configs && fern generate --local --force --group rust-sdk --version "$SDK_VERSION")
    cp LICENSE "{{SDK_RUST_ROOT}}/LICENSE"
    printf '# The Rust crate under vendor/crystalith-sdks/rust is generated via Fern (just sdk-gen-rust).\n# Do not edit generated files manually.\n' > "{{SDK_RUST_ROOT}}/.generated"
    echo "Rust SDK v${SDK_VERSION} generated at {{SDK_RUST_ROOT}}"

# Generate TypeScript SDK via openapi-ts (version from backend/py/pyproject.toml)
sdk-gen-typescript VERSION='':
    #!/usr/bin/env bash
    set -euo pipefail
    git submodule update --init --recursive vendor/crystalith-sdks
    BACKEND_VERSION="$(python -c 'import tomllib, pathlib; print(tomllib.loads(pathlib.Path("backend/py/pyproject.toml").read_text())["project"]["version"])')"
    SDK_VERSION="${VERSION:-$BACKEND_VERSION}"
    if [[ -n "{{VERSION}}" && "{{VERSION}}" != "$BACKEND_VERSION" ]]; then
      echo "SDK_VERSION ({{VERSION}}) must match backend version ($BACKEND_VERSION)" >&2; exit 1
    fi
    if [[ ! -f "{{SCHEMA_PATH}}" ]]; then
      echo "OpenAPI schema not found at {{SCHEMA_PATH}}. Run: just api-export" >&2; exit 1
    fi
    command -v pnpm >/dev/null 2>&1 || { echo "pnpm not found. Install: https://pnpm.io/installation" >&2; exit 1; }
    python - <<PY
    import json
    import pathlib

    path = pathlib.Path("{{SDK_TS_ROOT}}/package.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    data["version"] = "${SDK_VERSION}"
    path.write_text(json.dumps(data, indent=2) + "\\n", encoding="utf-8")
    PY
    cp LICENSE "{{SDK_TS_ROOT}}/LICENSE"
    printf '# The TypeScript package under vendor/crystalith-sdks/typescript is generated via openapi-ts (just sdk-gen-typescript).\\n# Do not edit generated files manually.\\n' > "{{SDK_TS_ROOT}}/.generated"
    pnpm -C "{{SDK_TS_ROOT}}" install --frozen-lockfile
    pnpm -C "{{SDK_TS_ROOT}}" run generate
    echo "TypeScript SDK v${SDK_VERSION} generated at {{SDK_TS_ROOT}}"

# Check backend/SDK versions are consistent (no generation).
sdk-version-check:
    #!/usr/bin/env bash
    set -euo pipefail
    git submodule update --init --recursive vendor/crystalith-sdks
    BACKEND_VERSION="$(python -c 'import tomllib, pathlib; print(tomllib.loads(pathlib.Path("backend/py/pyproject.toml").read_text())["project"]["version"])')"
    SDK_VERSION="$(python -c 'import tomllib, pathlib; print(tomllib.loads(pathlib.Path("vendor/crystalith-sdks/python/pyproject.toml").read_text())["project"]["version"])')"
    SDK_FILE_VERSION="$(tr -d '\r\n' < "vendor/crystalith-sdks/python/.sdk-version")"
    TS_SDK_VERSION="$(python -c 'import json, pathlib; print(json.loads(pathlib.Path("vendor/crystalith-sdks/typescript/package.json").read_text())["version"])')"
    if [[ "$BACKEND_VERSION" != "$SDK_VERSION" ]]; then
      echo "SDK version mismatch: backend/py=$BACKEND_VERSION vendor/crystalith-sdks/python/pyproject.toml=$SDK_VERSION" >&2
      exit 1
    fi
    if [[ "$BACKEND_VERSION" != "$SDK_FILE_VERSION" ]]; then
      echo "SDK version mismatch: backend/py=$BACKEND_VERSION vendor/crystalith-sdks/python/.sdk-version=$SDK_FILE_VERSION" >&2
      exit 1
    fi
    if [[ "$BACKEND_VERSION" != "$TS_SDK_VERSION" ]]; then
      echo "SDK version mismatch: backend/py=$BACKEND_VERSION vendor/crystalith-sdks/typescript/package.json=$TS_SDK_VERSION" >&2
      exit 1
    fi
    echo "SDK version OK: $BACKEND_VERSION"

# Generate all SDKs: export schema → frontend SDK → Python SDK
sdk-gen VERSION='': api-export sdk-gen-web (sdk-gen-python VERSION)

# Build TypeScript SDK (dist + types)
sdk-build-typescript:
    pnpm -C {{SDK_TS_ROOT}} install --frozen-lockfile
    pnpm -C {{SDK_TS_ROOT}} run build

# Check TypeScript SDK is up to date (for pre-commit)
sdk-check-typescript: (sdk-gen-typescript)
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -n "$(git -C vendor/crystalith-sdks status --porcelain -- typescript)" ]]; then
      echo "TypeScript SDK is out of date. Run: just sdk-gen-typescript" >&2
      exit 1
    fi

# Check Python SDK is up to date (for pre-commit)
sdk-check: api-export (sdk-gen-python)
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -n "$(git -C vendor/crystalith-sdks status --porcelain -- python)" ]]; then
      echo "Python SDK is out of date. Run: just sdk-gen-python" >&2
      exit 1
    fi

# Build Python SDK (wheel/sdist)
sdk-build-python:
    cd {{SDK_ROOT}} && uv build --no-sources --clear

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
