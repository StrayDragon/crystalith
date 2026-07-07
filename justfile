_default:
    @just -l

SDK_ROOT := "vendor/crystalith-sdks/python"
SDK_PACKAGE_PATH := "vendor/crystalith-sdks/python/src/crystalith_sdk"
SDK_TS_ROOT := "vendor/crystalith-sdks/typescript"
SDK_GO_ROOT := "vendor/crystalith-sdks/go"
SDK_RUST_ROOT := "vendor/crystalith-sdks/rust"
SCHEMA_PATH := "frontend/web/openapi.gen.json"

# --------------------------------------------------------------------------
# Unified Entry (just up [profile])
#
# Profiles: local | hybrid | docker | full
# See scripts/orchestrate.sh or .env.example for details.
# --------------------------------------------------------------------------

# Upsert .env and config/secret.env from shell environment variables (safe: never overwrites existing values)
upsert-env-configs:
    bash ./scripts/init_config.sh

# Start Crystalith with the given profile (default: hybrid)
up PROFILE='' *ARGS='':
    bash ./scripts/orchestrate.sh up "{{PROFILE}}" {{ARGS}}

# Stop Crystalith for the given profile
down PROFILE='' *ARGS='':
    bash ./scripts/orchestrate.sh down "{{PROFILE}}" {{ARGS}}

# Show running status for the given profile
status PROFILE='':
    bash ./scripts/orchestrate.sh status "{{PROFILE}}"

# Show logs for the given profile
logs PROFILE='' *ARGS='':
    bash ./scripts/orchestrate.sh logs "{{PROFILE}}" {{ARGS}}

# --------------------------------------------------------------------------
# API Schema
# --------------------------------------------------------------------------

# Export latest API schema from backend
api-export:
    cd backend/py && uv run scripts/api_schema.py export -o ../../frontend/web/openapi.gen.json

# Check if API schema is up to date (for CI/pre-commit)
api-check:
    cd backend/py && uv run scripts/api_schema.py check -s ../../frontend/web/openapi.gen.json

# --------------------------------------------------------------------------
# SDK Generation
# --------------------------------------------------------------------------

# Generate frontend SDK (OpenAPI → TypeScript)
sdk-gen-web:
    cd frontend/web && pnpm run api:generate

# Sync frontend: export schema + regenerate frontend SDK
api-sync: api-export sdk-gen-web

# Ensure the SDK monorepo submodule is checked out
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
    SUBMODULE_URL="$(git -C vendor/crystalith-sdks remote get-url origin || true)"
    if [[ "$SUBMODULE_URL" == https://github.com/* ]]; then
      git -C vendor/crystalith-sdks remote set-url --push origin "git@github.com:${SUBMODULE_URL#https://github.com/}"
    fi

# Generate Python SDK via Fern (version from backend/py/pyproject.toml)
sdk-gen-python VERSION='': sdk-submodule-update
    bash ./scripts/sdk_gen.sh python "{{VERSION}}"

# Generate Go SDK via Fern (version from backend/py/pyproject.toml)
sdk-gen-go VERSION='': sdk-submodule-update
    bash ./scripts/sdk_gen.sh go "{{VERSION}}"

# Generate Rust SDK via Fern (version from backend/py/pyproject.toml)
sdk-gen-rust VERSION='': sdk-submodule-update
    bash ./scripts/sdk_gen.sh rust "{{VERSION}}"

# Generate TypeScript SDK via openapi-ts (version from backend/py/pyproject.toml)
sdk-gen-typescript VERSION='': sdk-submodule-update
    bash ./scripts/sdk_gen.sh typescript "{{VERSION}}"

# Check backend/SDK versions are consistent (no generation).
sdk-version-check: sdk-submodule-update
    python scripts/sdk_version.py check-all

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

# Preflight check before tagging a release
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

# Release all client SDKs with a single version
sdk-release VERSION:
    bash ./scripts/sdk_release.sh "{{VERSION}}"

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
    @echo "==> Doc governance checks"
    just doc-governance-check
    @echo "==> Docs drift check"
    just docs-drift-check

# Run all tests
test: check test-backend test-frontend

# Run core regression suites only (fast-fail, manual by default)
test-core:
    cd backend/py && just test-core
    cd frontend/web && pnpm run test:core

# Run backend tests only
test-backend:
    cd backend/py && just test

# Run frontend tests only
test-frontend:
    cd frontend/web && pnpm run test:ci

# --------------------------------------------------------------------------
# Docs
# --------------------------------------------------------------------------

# Serve docs site (Zensical)
docs-serve *ARGS='':
    #!/usr/bin/env bash
    set -euo pipefail
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
      if [[ "${EXTRA_ARGS[0]}" == "--" ]]; then
        EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
      fi
    fi
    if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
      uv run --project docs zensical serve -f docs/zensical.toml "${EXTRA_ARGS[@]}"
    else
      uv run --project docs zensical serve -f docs/zensical.toml
    fi

# Build docs site (Zensical)
docs-build *ARGS='': gen-docs
    #!/usr/bin/env bash
    set -euo pipefail
    EXTRA_ARGS=({{ARGS}})
    if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
      if [[ "${EXTRA_ARGS[0]}" == "--" ]]; then
        EXTRA_ARGS=("${EXTRA_ARGS[@]:1}")
      fi
    fi
    if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
      uv run --project docs zensical build -f docs/zensical.toml "${EXTRA_ARGS[@]}"
    else
      uv run --project docs zensical build -f docs/zensical.toml
    fi

# Generate docs reference pages and injected blocks
gen-docs:
    cd backend/py && uv run scripts/gen_docs.py

# Check drift for docs generated pages/blocks (for CI/pre-commit)
docs-drift-check:
    cd backend/py && uv run scripts/gen_docs.py --check

# Fast repository governance checks for docs/instructions
doc-governance-check:
    cd backend/py && uv run scripts/check_doc_governance.py

# --------------------------------------------------------------------------
# Smoke Tests
# --------------------------------------------------------------------------

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
# Standalone Dev Helpers (used by Procfile / independent workflows)
# --------------------------------------------------------------------------

dev-frontend:
    just -f frontend/web/justfile dev

dev-slidev:
    pnpm -C frontend/packages/crystalith-slidev install --frozen-lockfile
    pnpm -C frontend/packages/crystalith-slidev run dev

# --------------------------------------------------------------------------
# Maintenance
# --------------------------------------------------------------------------

# Detect stale artifacts from old dev workflow (dry-run by default, pass --apply to execute)
cleanup *ARGS='':
    bash ./scripts/cleanup.sh {{ARGS}}

# Run pre-commit checks
check-pre-commit-hooks:
    prek run --all-files
