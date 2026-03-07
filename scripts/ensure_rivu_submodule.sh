#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUBMODULE_PATH="frontend/web/vendor/rivu"
MARKER_PATH="${ROOT_DIR}/${SUBMODULE_PATH}/packages/rivu-kernel/src/index.ts"

if [[ -f "$MARKER_PATH" ]]; then
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git not found; cannot initialize ${SUBMODULE_PATH}" >&2
  exit 1
fi

if ! git -C "$ROOT_DIR" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Missing .git metadata; cannot auto-initialize ${SUBMODULE_PATH}." >&2
  echo "Initialize submodules before running frontend build/dev/test commands." >&2
  exit 1
fi

cd "$ROOT_DIR"

git submodule sync --recursive "$SUBMODULE_PATH"

if ! git submodule update --init --recursive "$SUBMODULE_PATH"; then
  echo "Failed to checkout frontend submodule: ${SUBMODULE_PATH}" >&2
  echo "Run: git submodule update --init --recursive ${SUBMODULE_PATH}" >&2
  exit 1
fi
