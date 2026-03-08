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

rivu-submodule-update:
    bash ./scripts/ensure_rivu_submodule.sh

# Ensure the SDK monorepo submodule is checked out (with a clearer error message than raw git output).
sdk-submodule-update:
    #!/usr/bin/env bash
    set -euo pipefail
    git submodule sync --recursive
    if ! git submodule update --init --recursive vendor/crystalith-sdks; then
      echo "Failed to checkout SDK monorepo submodule: vendor/crystalith-sdks" >&2
      echo "Expected release flow:" >&2
      echo "  1) Generate SDKs and commit+push crystalith-sdks" >&2
      echo "  2) Update crystalith submodule pointer (vendor/crystalith-sdks) and push" >&2
      echo "  3) Tag crystalith-sdks (python/vX.Y.Z, typescript/vX.Y.Z, go/vX.Y.Z, rust/vX.Y.Z) and push tags" >&2
      echo "     (or: run just sdk-release X.Y.Z from crystalith)" >&2
      exit 1
    fi
    # Keep fetch URL as-is (often https), but make pushes use SSH for convenience.
    SUBMODULE_URL="$(git -C vendor/crystalith-sdks remote get-url origin || true)"
    if [[ "$SUBMODULE_URL" == https://github.com/* ]]; then
      git -C vendor/crystalith-sdks remote set-url --push origin "git@github.com:${SUBMODULE_URL#https://github.com/}"
    fi

# Generate Python SDK via Fern (version from backend/py/pyproject.toml)
sdk-gen-python VERSION='': sdk-submodule-update
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
sdk-gen-go VERSION='': sdk-submodule-update
    #!/usr/bin/env bash
    set -euo pipefail
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
      SHOULD_PATCH="0"
      if [[ "${FERN_GO_SDK_PATCH_IMAGE:-auto}" == "1" ]]; then
        SHOULD_PATCH="1"
      elif [[ "${FERN_GO_SDK_PATCH_IMAGE:-auto}" == "auto" ]]; then
        if ! command -v curl >/dev/null 2>&1; then
          SHOULD_PATCH="1"
        elif ! curl -fsSL --max-time 3 "https://proxy.golang.org/github.com/google/uuid/@v/v1.6.0.mod" >/dev/null 2>&1; then
          SHOULD_PATCH="1"
        fi
      else
        echo "Invalid FERN_GO_SDK_PATCH_IMAGE=${FERN_GO_SDK_PATCH_IMAGE} (expected: auto|0|1)" >&2
        exit 1
      fi
      if [[ "$SHOULD_PATCH" == "1" ]]; then
        command -v docker >/dev/null 2>&1 || { echo "docker not found (needed for --local generation). Install Docker or use --runner podman and adjust the patch step." >&2; exit 1; }
        docker build -t fernapi/fern-go-sdk:1.26.0 -f sdk/generators/fern-go-sdk/Dockerfile sdk/generators/fern-go-sdk
      fi
    fi
    (cd sdk/configs && fern generate --local --force --group go-sdk --version "$SDK_VERSION")
    cp LICENSE "{{SDK_GO_ROOT}}/LICENSE"
    printf '# The Go module under vendor/crystalith-sdks/go is generated via Fern (just sdk-gen-go).\n# Do not edit generated files manually.\n' > "{{SDK_GO_ROOT}}/.generated"
    echo "Go SDK v${SDK_VERSION} generated at {{SDK_GO_ROOT}}"

# Generate Rust SDK via Fern (version from backend/py/pyproject.toml)
sdk-gen-rust VERSION='': sdk-submodule-update
    #!/usr/bin/env bash
    set -euo pipefail
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
sdk-gen-typescript VERSION='': sdk-submodule-update
    #!/usr/bin/env bash
    set -euo pipefail
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
sdk-version-check: sdk-submodule-update
    #!/usr/bin/env bash
    set -euo pipefail
    BACKEND_VERSION="$(python -c 'import tomllib, pathlib; print(tomllib.loads(pathlib.Path("backend/py/pyproject.toml").read_text())["project"]["version"])')"
    SDK_VERSION="$(python -c 'import tomllib, pathlib; print(tomllib.loads(pathlib.Path("vendor/crystalith-sdks/python/pyproject.toml").read_text())["project"]["version"])')"
    SDK_FILE_VERSION="$(tr -d '\r\n' < "vendor/crystalith-sdks/python/.sdk-version")"
    TS_SDK_VERSION="$(python -c 'import json, pathlib; print(json.loads(pathlib.Path("vendor/crystalith-sdks/typescript/package.json").read_text())["version"])')"
    RUST_SDK_VERSION="$(python -c 'import tomllib, pathlib; print(tomllib.loads(pathlib.Path("vendor/crystalith-sdks/rust/Cargo.toml").read_text())["package"]["version"])')"
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
    if [[ "$BACKEND_VERSION" != "$RUST_SDK_VERSION" ]]; then
      echo "SDK version mismatch: backend/py=$BACKEND_VERSION vendor/crystalith-sdks/rust/Cargo.toml=$RUST_SDK_VERSION" >&2
      exit 1
    fi
    echo "SDK version OK: $BACKEND_VERSION"

# Generate all SDKs: export schema → frontend SDK → Python SDK
sdk-gen VERSION='': api-export sdk-gen-web (sdk-gen-python VERSION)

# Build TypeScript SDK (dist + types)
sdk-build-typescript: sdk-submodule-update
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
sdk-build-python: sdk-submodule-update
    cd {{SDK_ROOT}} && uv build --no-sources --clear

# Preflight check before tagging a release (ensures submodule is committed and pushed).
sdk-release-preflight: sdk-submodule-update
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -n "$(git status --porcelain)" ]]; then
      echo "Working tree is dirty. Commit changes before tagging a release." >&2
      git status --porcelain >&2
      exit 1
    fi
    if [[ -n "$(git -C vendor/crystalith-sdks status --porcelain)" ]]; then
      echo "SDK monorepo has uncommitted changes. Commit+push crystalith-sdks first." >&2
      git -C vendor/crystalith-sdks status --porcelain >&2
      exit 1
    fi
    RECORDED_SHA="$(git ls-files --stage vendor/crystalith-sdks | awk '{print $2}')"
    CURRENT_SHA="$(git -C vendor/crystalith-sdks rev-parse HEAD)"
    if [[ "$RECORDED_SHA" != "$CURRENT_SHA" ]]; then
      echo "Submodule pointer is not committed in crystalith." >&2
      echo "Recorded: $RECORDED_SHA" >&2
      echo "Checked out: $CURRENT_SHA" >&2
      echo "Fix: commit and push the updated submodule pointer, then tag vX.Y.Z." >&2
      exit 1
    fi
    git -C vendor/crystalith-sdks fetch origin main
    if ! git -C vendor/crystalith-sdks merge-base --is-ancestor "$CURRENT_SHA" origin/main; then
      echo "crystalith-sdks commit $CURRENT_SHA is not on origin/main. Push/merge it before tagging." >&2
      exit 1
    fi
    echo "SDK release preflight OK."

sdk-release-check: sdk-release-preflight
    just sdk-version-check
    just api-check
    echo "SDK release checks OK."

# Release all client SDKs with a single version:
# 1) sync OpenAPI + frontend client
# 2) generate python/typescript/go/rust SDKs
# 3) commit+push crystalith-sdks
# 4) tag crystalith-sdks (go/python/typescript/rust)
# 5) commit+push crystalith (submodule pointer + schema/client)
# 6) tag crystalith (vX.Y.Z) for overall release
sdk-release VERSION:
    #!/usr/bin/env bash
    set -euo pipefail

    VERSION="{{VERSION}}"
    TAG="v${VERSION}"

    if [[ -z "$VERSION" ]]; then
      echo "Usage: just sdk-release X.Y.Z" >&2
      exit 1
    fi

    if [[ -n "$(git status --porcelain)" ]]; then
      echo "Working tree is dirty. Commit/stash changes before running sdk-release." >&2
      git status --porcelain >&2
      exit 1
    fi

    BRANCH="$(git rev-parse --abbrev-ref HEAD)"
    if [[ "$BRANCH" != "main" ]]; then
      echo "sdk-release must be run on branch 'main' (current: $BRANCH)" >&2
      exit 1
    fi

    git fetch origin main --tags
    if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
      echo "Tag already exists on origin: ${TAG}" >&2
      exit 1
    fi

    BACKEND_VERSION="$(python -c 'import tomllib, pathlib; print(tomllib.loads(pathlib.Path("backend/py/pyproject.toml").read_text())["project"]["version"])')"
    if [[ "$BACKEND_VERSION" != "$VERSION" ]]; then
      echo "Version mismatch: requested=$VERSION backend/py=$BACKEND_VERSION" >&2
      echo "Update backend/py/pyproject.toml first, then rerun: just sdk-release $BACKEND_VERSION" >&2
      exit 1
    fi

    just sdk-submodule-update
    if [[ -n "$(git -C vendor/crystalith-sdks status --porcelain)" ]]; then
      echo "SDK monorepo submodule has uncommitted changes. Commit/stash them first." >&2
      git -C vendor/crystalith-sdks status --porcelain >&2
      exit 1
    fi
    git -C vendor/crystalith-sdks fetch origin main
    git -C vendor/crystalith-sdks pull --rebase origin main

    # Keep OpenAPI + frontend generated client in sync (CI requires this).
    just api-sync

    # Generate SDKs into crystalith-sdks.
    just sdk-gen-python VERSION="$VERSION"
    just sdk-gen-typescript VERSION="$VERSION"
    just sdk-gen-go VERSION="$VERSION"
    just sdk-gen-rust VERSION="$VERSION"

    # Commit + push crystalith-sdks (if changed).
    if [[ -n "$(git -C vendor/crystalith-sdks status --porcelain)" ]]; then
      git -C vendor/crystalith-sdks add -A
      git -C vendor/crystalith-sdks commit -m "chore: release sdks ${TAG}"
      git -C vendor/crystalith-sdks push origin main
    else
      echo "No changes detected in crystalith-sdks; skipping commit."
    fi

    # Tag the monorepo (use per-language tags; Go requires the subdir prefix).
    for prefix in go python typescript rust; do
      T="${prefix}/${TAG}"
      if git -C vendor/crystalith-sdks ls-remote --exit-code --tags origin "refs/tags/${T}" >/dev/null 2>&1; then
        echo "Tag already exists on crystalith-sdks origin: ${T}" >&2
        exit 1
      fi
      git -C vendor/crystalith-sdks tag "${T}"
    done
    git -C vendor/crystalith-sdks push origin "go/${TAG}" "python/${TAG}" "typescript/${TAG}" "rust/${TAG}"

    # Commit + push crystalith (schema/client + submodule pointer).
    git add frontend/web/openapi.json frontend/web/src/api/generated vendor/crystalith-sdks
    if [[ -n "$(git diff --cached --name-only)" ]]; then
      git commit -m "chore(release): ${TAG}"
      git push origin main
    else
      echo "No changes to commit in crystalith; skipping commit."
    fi

    # Final preflight: ensure submodule pointer is committed and monorepo commit is pushed.
    just sdk-release-preflight

    # Tag + push tag for crystalith release.
    git tag "${TAG}"
    git push origin "${TAG}"
    echo "Release tag pushed: ${TAG}"

# --------------------------------------------------------------------------
# Testing
# --------------------------------------------------------------------------

# Run fast repository guardrails (no full test suite)
check:
    @echo "==> Backend guardrails"
    cd backend/py && just check
    @echo "==> OpenAPI schema consistency"
    just api-check
    @echo "==> Frontend incremental lint"
    pnpm -C frontend/web run lint
    @echo "==> Frontend format check"
    pnpm -C frontend/web run format:check
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
# Default overlays: storage + redis + searxng.
# Available overlays: storage redis searxng ollama slidev host-remap
# Example:
#   just DEV_OPTIONALS="storage redis searxng ollama" dev-docker-up
# --------------------------------------------------------------------------

COMPOSE_CORE_FILE := "deployments/prod/docker-compose.yml"
DEV_OPTIONALS := "storage redis searxng"
CHINA_APT_MIRROR := "https://mirrors.tuna.tsinghua.edu.cn/debian"
CHINA_UV_INDEX_URL := "https://mirrors.aliyun.com/pypi/simple/"
CHINA_NPM_REGISTRY := "https://registry.npmmirror.com"

dev-docker-up *ARGS='':
    #!/usr/bin/env bash
    set -euo pipefail
    bash ./scripts/ensure_rivu_submodule.sh
    ENV_FILE="${ENV_FILE:-.env}"
    if [[ ! -f "$ENV_FILE" ]]; then
      ENV_FILE=".env.example"
      echo "[dev-docker-up] ENV_FILE not found; using $ENV_FILE (copy to .env to customize)."
    fi
    FILES=(-f {{COMPOSE_CORE_FILE}})
    for optional in {{DEV_OPTIONALS}}; do
      FILES+=(-f "deployments/prod/docker-compose.${optional}.yml")
    done
    BUILD_FLAG="--build"
    case "${DEV_BUILD:-1}" in 0|false|no|off) BUILD_FLAG="" ;; esac
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 && "${EXTRA_ARGS[0]}" == "--" ]]; then
      EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
    fi
    env \
      -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u NO_PROXY \
      -u http_proxy -u https_proxy -u all_proxy -u no_proxy \
      APT_MIRROR="${APT_MIRROR:-{{CHINA_APT_MIRROR}}}" \
      UV_INDEX_URL="${UV_INDEX_URL:-{{CHINA_UV_INDEX_URL}}}" \
      NPM_REGISTRY="${NPM_REGISTRY:-{{CHINA_NPM_REGISTRY}}}" \
      docker compose --env-file "$ENV_FILE" "${FILES[@]}" up -d ${BUILD_FLAG} "${EXTRA_ARGS[@]}"

dev-docker-down *ARGS='':
    #!/usr/bin/env bash
    set -euo pipefail
    ENV_FILE="${ENV_FILE:-.env}"
    if [[ ! -f "$ENV_FILE" ]]; then
      ENV_FILE=".env.example"
      echo "[dev-docker-down] ENV_FILE not found; using $ENV_FILE (copy to .env to customize)."
    fi
    FILES=(-f {{COMPOSE_CORE_FILE}})
    for optional in {{DEV_OPTIONALS}}; do
      FILES+=(-f "deployments/prod/docker-compose.${optional}.yml")
    done
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 && "${EXTRA_ARGS[0]}" == "--" ]]; then
      EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
    fi
    docker compose --env-file "$ENV_FILE" "${FILES[@]}" down "${EXTRA_ARGS[@]}"

dev-docker-ps:
    #!/usr/bin/env bash
    set -euo pipefail
    ENV_FILE="${ENV_FILE:-.env}"
    if [[ ! -f "$ENV_FILE" ]]; then
      ENV_FILE=".env.example"
      echo "[dev-docker-ps] ENV_FILE not found; using $ENV_FILE (copy to .env to customize)."
    fi
    FILES=(-f {{COMPOSE_CORE_FILE}})
    for optional in {{DEV_OPTIONALS}}; do
      FILES+=(-f "deployments/prod/docker-compose.${optional}.yml")
    done
    docker compose --env-file "$ENV_FILE" "${FILES[@]}" ps

dev-docker-logs *ARGS='':
    #!/usr/bin/env bash
    set -euo pipefail
    ENV_FILE="${ENV_FILE:-.env}"
    if [[ ! -f "$ENV_FILE" ]]; then
      ENV_FILE=".env.example"
      echo "[dev-docker-logs] ENV_FILE not found; using $ENV_FILE (copy to .env to customize)."
    fi
    FILES=(-f {{COMPOSE_CORE_FILE}})
    for optional in {{DEV_OPTIONALS}}; do
      FILES+=(-f "deployments/prod/docker-compose.${optional}.yml")
    done
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 && "${EXTRA_ARGS[0]}" == "--" ]]; then
      EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
    fi
    docker compose --env-file "$ENV_FILE" "${FILES[@]}" logs -f "${EXTRA_ARGS[@]}"

dev-docker-rebuild SERVICE:
    #!/usr/bin/env bash
    set -euo pipefail
    bash ./scripts/ensure_rivu_submodule.sh
    ENV_FILE="${ENV_FILE:-.env}"
    if [[ ! -f "$ENV_FILE" ]]; then
      ENV_FILE=".env.example"
      echo "[dev-docker-rebuild] ENV_FILE not found; using $ENV_FILE (copy to .env to customize)."
    fi
    FILES=(-f {{COMPOSE_CORE_FILE}})
    for optional in {{DEV_OPTIONALS}}; do
      FILES+=(-f "deployments/prod/docker-compose.${optional}.yml")
    done
    env \
      -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u NO_PROXY \
      -u http_proxy -u https_proxy -u all_proxy -u no_proxy \
      APT_MIRROR="${APT_MIRROR:-{{CHINA_APT_MIRROR}}}" \
      UV_INDEX_URL="${UV_INDEX_URL:-{{CHINA_UV_INDEX_URL}}}" \
      NPM_REGISTRY="${NPM_REGISTRY:-{{CHINA_NPM_REGISTRY}}}" \
      docker compose --env-file "$ENV_FILE" "${FILES[@]}" up -d --build --no-deps {{SERVICE}}

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
# Dev (host hot reload + docker deps)
#
# Default overlays: storage + redis + searxng.
# Available overlays: storage redis ollama searxng
# Example:
#   just DEV_DEPS_OPTIONALS="storage redis ollama" dev-deps-up
# --------------------------------------------------------------------------

DEV_DEPS_CORE_FILE := "deployments/dev/docker-compose.deps.yml"
DEV_DEPS_OPTIONALS := "storage redis searxng"
DEV_DEPS_PROJECT := "crystalith-dev-deps"

dev-deps-up *ARGS='':
    #!/usr/bin/env bash
    set -euo pipefail
    ENV_FILE="${ENV_FILE:-.env}"
    if [[ ! -f "$ENV_FILE" ]]; then
      ENV_FILE=".env.example"
      echo "[dev-deps-up] ENV_FILE not found; using $ENV_FILE (copy to .env to customize)."
    fi
    PROJECT="${DEV_DEPS_PROJECT:-{{DEV_DEPS_PROJECT}}}"
    FILES=(-f {{DEV_DEPS_CORE_FILE}})

    optionals="{{DEV_DEPS_OPTIONALS}}"
    for optional in $optionals; do
      if [[ "$optional" == "searxng" ]]; then
        searxng_port="${CL_DEPS_SEARXNG_PORT:-50201}"
        if python -c 'import socket, sys; host=sys.argv[1]; port=int(sys.argv[2]); s=socket.socket(); s.settimeout(0.2); s.connect((host, port)); s.close()' \
          "127.0.0.1" "$searxng_port" >/dev/null 2>&1
        then
          searxng_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${searxng_port}/search?q=&format=json" || true)"
          if [[ "$searxng_status" == "200" || "$searxng_status" == "400" ]]
          then
            echo "[dev-deps-up] Detected existing searxng on :${searxng_port}; skipping deps overlay (searxng)."
            continue
          fi
          echo "[dev-deps-up] Port ${searxng_port} is already in use, but it does not look like a SearXNG instance." >&2
          echo "  - Stop the process using :${searxng_port}, or set CL_DEPS_SEARXNG_PORT to a free port, or remove 'searxng' from DEV_DEPS_OPTIONALS." >&2
          exit 1
        fi
      fi
      FILES+=(-f "deployments/dev/docker-compose.deps.${optional}.yml")
    done
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 && "${EXTRA_ARGS[0]}" == "--" ]]; then
      EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
    fi
    docker compose -p "$PROJECT" --env-file "$ENV_FILE" "${FILES[@]}" up -d "${EXTRA_ARGS[@]}"

dev-deps-down *ARGS='':
    #!/usr/bin/env bash
    set -euo pipefail
    ENV_FILE="${ENV_FILE:-.env}"
    if [[ ! -f "$ENV_FILE" ]]; then
      ENV_FILE=".env.example"
      echo "[dev-deps-down] ENV_FILE not found; using $ENV_FILE (copy to .env to customize)."
    fi
    PROJECT="${DEV_DEPS_PROJECT:-{{DEV_DEPS_PROJECT}}}"
    FILES=(-f {{DEV_DEPS_CORE_FILE}})
    for optional in {{DEV_DEPS_OPTIONALS}}; do
      FILES+=(-f "deployments/dev/docker-compose.deps.${optional}.yml")
    done
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 && "${EXTRA_ARGS[0]}" == "--" ]]; then
      EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
    fi
    docker compose -p "$PROJECT" --env-file "$ENV_FILE" "${FILES[@]}" down "${EXTRA_ARGS[@]}"

dev-deps-ps:
    #!/usr/bin/env bash
    set -euo pipefail
    ENV_FILE="${ENV_FILE:-.env}"
    if [[ ! -f "$ENV_FILE" ]]; then
      ENV_FILE=".env.example"
      echo "[dev-deps-ps] ENV_FILE not found; using $ENV_FILE (copy to .env to customize)."
    fi
    PROJECT="${DEV_DEPS_PROJECT:-{{DEV_DEPS_PROJECT}}}"
    FILES=(-f {{DEV_DEPS_CORE_FILE}})
    for optional in {{DEV_DEPS_OPTIONALS}}; do
      FILES+=(-f "deployments/dev/docker-compose.deps.${optional}.yml")
    done
    docker compose -p "$PROJECT" --env-file "$ENV_FILE" "${FILES[@]}" ps

dev-deps-logs *ARGS='':
    #!/usr/bin/env bash
    set -euo pipefail
    ENV_FILE="${ENV_FILE:-.env}"
    if [[ ! -f "$ENV_FILE" ]]; then
      ENV_FILE=".env.example"
      echo "[dev-deps-logs] ENV_FILE not found; using $ENV_FILE (copy to .env to customize)."
    fi
    PROJECT="${DEV_DEPS_PROJECT:-{{DEV_DEPS_PROJECT}}}"
    FILES=(-f {{DEV_DEPS_CORE_FILE}})
    for optional in {{DEV_DEPS_OPTIONALS}}; do
      FILES+=(-f "deployments/dev/docker-compose.deps.${optional}.yml")
    done
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 && "${EXTRA_ARGS[0]}" == "--" ]]; then
      EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
    fi
    docker compose -p "$PROJECT" --env-file "$ENV_FILE" "${FILES[@]}" logs -f "${EXTRA_ARGS[@]}"

dev-backend:
    #!/usr/bin/env bash
    set -euo pipefail
    optionals="{{DEV_DEPS_OPTIONALS}}"
    has_optional() { for o in $optionals; do [[ "$o" == "$1" ]] && return 0; done; return 1; }

    postgres_port="${CL_DEPS_POSTGRES_PORT:-5434}"
    chroma_port="${CL_DEPS_CHROMA_PORT:-8001}"
    redis_port="${CL_DEPS_REDIS_PORT:-6380}"
    ollama_port="${CL_DEPS_OLLAMA_PORT:-11434}"
    searxng_port="${CL_DEPS_SEARXNG_PORT:-50201}"

    wait_tcp() {
      local host="$1"
      local port="$2"
      local timeout_s="${3:-120}"
      local start
      start="$(date +%s)"
      while true; do
        if python -c 'import socket, sys; host = sys.argv[1]; port = int(sys.argv[2]); s = socket.socket(); s.settimeout(1.0); s.connect((host, port)); s.close()' "$host" "$port" >/dev/null 2>&1
        then
          return 0
        fi
        if (( "$(date +%s)" - start >= timeout_s )); then
          echo "timeout waiting for tcp ${host}:${port}" >&2
          return 1
        fi
        sleep 1
      done
    }

    wait_http() {
      local url="$1"
      local timeout_s="${2:-120}"
      local start
      start="$(date +%s)"
      while true; do
        if python -c 'import sys, urllib.request; urllib.request.urlopen(sys.argv[1], timeout=2).read()' "$url" >/dev/null 2>&1
        then
          return 0
        fi
        if (( "$(date +%s)" - start >= timeout_s )); then
          echo "timeout waiting for http ${url}" >&2
          return 1
        fi
        sleep 1
      done
    }

    if has_optional storage; then
      wait_tcp 127.0.0.1 "$postgres_port" 120
      wait_http "http://127.0.0.1:${chroma_port}/api/v1/heartbeat" 120
    fi

    if has_optional redis; then
      wait_tcp 127.0.0.1 "$redis_port" 60
    fi

    if has_optional searxng; then
      searxng_url="http://127.0.0.1:${searxng_port}/search?q=&format=json"
      start_ts="$(date +%s)"
      while true; do
        searxng_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$searxng_url" || true)"
        if [[ "$searxng_status" == "200" || "$searxng_status" == "400" ]]; then
          break
        fi
        if (( "$(date +%s)" - start_ts >= 60 )); then
          echo "timeout waiting for http ${searxng_url}" >&2
          exit 1
        fi
        sleep 1
      done
    fi

    env_args=()
    env_args+=(HOST="${HOST:-0.0.0.0}")
    env_args+=(PORT="${PORT:-8032}")
    env_args+=(RELOAD="${RELOAD:-1}")

    exec env "${env_args[@]}" uv run --project backend/py python backend/py/main.py

dev-frontend:
    just -f frontend/web/justfile dev

dev-slidev:
    pnpm -C frontend/packages/crystalith-slidev install --frozen-lockfile
    pnpm -C frontend/packages/crystalith-slidev run dev

dev:
    #!/usr/bin/env bash
    set -euo pipefail
    just dev-deps-up
    just dev-backend &
    backend_pid="$!"
    trap 'kill "$backend_pid" >/dev/null 2>&1 || true' EXIT
    just dev-frontend

# --------------------------------------------------------------------------
# Misc
# --------------------------------------------------------------------------

# Run pre-commit checks
check-pre-commit-hooks:
    prek run --all-files
