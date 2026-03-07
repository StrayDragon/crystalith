#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend/web"
MODULES_MARKER="${FRONTEND_DIR}/node_modules/.modules.yaml"

bash "${ROOT_DIR}/scripts/ensure_rivu_submodule.sh"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found; cannot prepare frontend/web dependencies" >&2
  exit 1
fi

cd "$FRONTEND_DIR"

if [[ "${CRYSTALITH_SKIP_FRONTEND_READY_INSTALL:-0}" == "1" ]]; then
  exit 0
fi

if [[ ! -f "$MODULES_MARKER" || package.json -nt "$MODULES_MARKER" || pnpm-lock.yaml -nt "$MODULES_MARKER" ]]; then
  pnpm install --frozen-lockfile
fi
