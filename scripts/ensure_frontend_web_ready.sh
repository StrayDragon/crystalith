#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend/web"
MODULES_MARKER="${FRONTEND_DIR}/node_modules/.modules.yaml"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found; cannot prepare frontend/web dependencies" >&2
  exit 1
fi

cd "$FRONTEND_DIR"

if [[ "${CRYSTALITH_SKIP_FRONTEND_READY_INSTALL:-0}" == "1" ]]; then
  exit 0
fi

if [[ ! -f "$MODULES_MARKER" || package.json -nt "$MODULES_MARKER" || bun.lock -nt "$MODULES_MARKER" ]]; then
  bun install --frozen-lockfile
fi
