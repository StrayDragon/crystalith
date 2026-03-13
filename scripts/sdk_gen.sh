#!/usr/bin/env bash
# SDK generation helper — shared pre-checks and post-generation steps.
#
# Usage:
#   scripts/sdk_gen.sh python [VERSION]
#   scripts/sdk_gen.sh go [VERSION]
#   scripts/sdk_gen.sh rust [VERSION]
#   scripts/sdk_gen.sh typescript [VERSION]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LANG="${1:?Usage: sdk_gen.sh <python|go|rust|typescript> [VERSION]}"
VERSION="${2:-}"

SCHEMA_PATH="frontend/web/openapi.gen.json"
SDK_ROOT="vendor/crystalith-sdks/python"
SDK_PACKAGE_PATH="vendor/crystalith-sdks/python/src/crystalith_sdk"
SDK_TS_ROOT="vendor/crystalith-sdks/typescript"
SDK_GO_ROOT="vendor/crystalith-sdks/go"
SDK_RUST_ROOT="vendor/crystalith-sdks/rust"

BACKEND_VERSION="$(python scripts/sdk_version.py get-backend)"
SDK_VERSION="${VERSION:-$BACKEND_VERSION}"

if [[ -n "$VERSION" && "$VERSION" != "$BACKEND_VERSION" ]]; then
  echo "SDK_VERSION ($VERSION) must match backend version ($BACKEND_VERSION)" >&2
  exit 1
fi

python scripts/sdk_version.py check-schema "$SCHEMA_PATH"

case "$LANG" in
  python)
    python scripts/sdk_version.py check-fern
    (cd sdk/configs && fern generate --local --force --group python-sdk --version "$SDK_VERSION")
    if [[ ! -f "${SDK_PACKAGE_PATH}/.fern/metadata.json" ]]; then
      echo "Fern metadata not found. Ensure generation succeeded." >&2; exit 1
    fi
    echo "$SDK_VERSION" > "${SDK_ROOT}/.sdk-version"
    cp LICENSE "${SDK_ROOT}/LICENSE"
    printf '# The Python package under src/crystalith_sdk is generated via Fern (just sdk-gen-python).\n# Do not edit generated files manually.\n' > "${SDK_ROOT}/.generated"
    touch "${SDK_PACKAGE_PATH}/py.typed"
    (cd "${SDK_ROOT}" && uv version "$SDK_VERSION" --frozen)
    echo "Python SDK v${SDK_VERSION} generated at ${SDK_PACKAGE_PATH}"
    ;;

  go)
    python scripts/sdk_version.py check-fern
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
        command -v docker >/dev/null 2>&1 || { echo "docker not found (needed for --local generation)." >&2; exit 1; }
        docker build -t fernapi/fern-go-sdk:1.26.0 -f sdk/generators/fern-go-sdk/Dockerfile sdk/generators/fern-go-sdk
      fi
    fi
    (cd sdk/configs && fern generate --local --force --group go-sdk --version "$SDK_VERSION")
    cp LICENSE "${SDK_GO_ROOT}/LICENSE"
    printf '# The Go module under vendor/crystalith-sdks/go is generated via Fern (just sdk-gen-go).\n# Do not edit generated files manually.\n' > "${SDK_GO_ROOT}/.generated"
    echo "Go SDK v${SDK_VERSION} generated at ${SDK_GO_ROOT}"
    ;;

  rust)
    python scripts/sdk_version.py check-fern
    (cd sdk/configs && fern generate --local --force --group rust-sdk --version "$SDK_VERSION")
    cp LICENSE "${SDK_RUST_ROOT}/LICENSE"
    printf '# The Rust crate under vendor/crystalith-sdks/rust is generated via Fern (just sdk-gen-rust).\n# Do not edit generated files manually.\n' > "${SDK_RUST_ROOT}/.generated"
    echo "Rust SDK v${SDK_VERSION} generated at ${SDK_RUST_ROOT}"
    ;;

  typescript)
    command -v pnpm >/dev/null 2>&1 || { echo "pnpm not found. Install: https://pnpm.io/installation" >&2; exit 1; }
    python scripts/sdk_version.py set-ts-version "$SDK_VERSION"
    cp LICENSE "${SDK_TS_ROOT}/LICENSE"
    printf '# The TypeScript package under vendor/crystalith-sdks/typescript is generated via openapi-ts (just sdk-gen-typescript).\n# Do not edit generated files manually.\n' > "${SDK_TS_ROOT}/.generated"
    pnpm -C "${SDK_TS_ROOT}" install --frozen-lockfile
    pnpm -C "${SDK_TS_ROOT}" run generate
    echo "TypeScript SDK v${SDK_VERSION} generated at ${SDK_TS_ROOT}"
    ;;

  *)
    echo "Unknown language: $LANG" >&2; exit 1 ;;
esac
