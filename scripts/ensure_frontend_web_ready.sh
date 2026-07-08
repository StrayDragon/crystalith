#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${ROOT_DIR}/apps/web"
MODULES_MARKER="${ROOT_DIR}/node_modules/.modules.yaml"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found; cannot prepare dependencies" >&2
  exit 1
fi

if [[ "${CRYSTALITH_SKIP_READY_INSTALL:-0}" == "1" ]]; then
  exit 0
fi

if [[ ! -f "$MODULES_MARKER" || package.json -nt "$MODULES_MARKER" || bun.lock -nt "$MODULES_MARKER" ]]; then
  cd "$ROOT_DIR" && bun install --frozen-lockfile
fi
