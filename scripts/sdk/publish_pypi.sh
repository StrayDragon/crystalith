#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
DIST_DIR="$ROOT_DIR/sdk/client/python/dist"

if [[ -z "${PYPI_API_TOKEN:-}" ]]; then
  echo "PYPI_API_TOKEN is required for token-based publish" >&2
  exit 1
fi

python -m pip install -U twine
python -m twine upload --non-interactive -u __token__ -p "$PYPI_API_TOKEN" "$DIST_DIR"/*
