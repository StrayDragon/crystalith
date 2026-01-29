#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

UV_CACHE_DIR="${UV_CACHE_DIR:-$ROOT_DIR/.cache/uv}"
mkdir -p "$UV_CACHE_DIR"
export UV_CACHE_DIR

if ! command -v overmind >/dev/null 2>&1; then
  echo "Error: overmind is required. Install it or run services manually." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required for readiness checks." >&2
  exit 1
fi

BACKEND_URL="${E2E_API_URL:-http://127.0.0.1:8032}"
FRONTEND_URL="${E2E_BASE_URL:-http://localhost:3000}"
FRONTEND_FALLBACK="http://127.0.0.1:3000"

cleanup() {
  if [[ -n "${OVERMIND_PID:-}" ]]; then
    kill "$OVERMIND_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ -S "$ROOT_DIR/.overmind.sock" ]]; then
  if overmind status >/dev/null 2>&1; then
    echo "Overmind already running; reusing existing session."
  else
    echo "Stale overmind socket found; removing and restarting."
    rm -f "$ROOT_DIR/.overmind.sock"
  fi
fi

if [[ ! -S "$ROOT_DIR/.overmind.sock" ]]; then
  echo "Starting E2E stack via Procfile.e2e..."
  overmind s -f Procfile.e2e >/tmp/overmind-e2e.log 2>&1 &
  OVERMIND_PID=$!
  sleep 1
  if ! overmind status >/dev/null 2>&1; then
    echo "Overmind failed to start; falling back to manual processes."
    kill "$OVERMIND_PID" >/dev/null 2>&1 || true
    unset OVERMIND_PID

    echo "Starting backend manually..."
    (
      cd "$ROOT_DIR"
      HOST=0.0.0.0 PORT=8032 RELOAD=1 AUTO_DB_INIT=1 \
        CRYSTALITH_DATABASE__URL=sqlite+aiosqlite:///./data/e2e.db \
        CRYSTALITH_VECTOR_STORAGE__PROVIDER=sqlite \
        CRYSTALITH_VECTOR_STORAGE__SQLITE__PATH=./data/vectors-e2e.db \
        uv run --project backend/py python backend/py/main.py
    ) >/tmp/e2e-backend.log 2>&1 &
    BACKEND_PID=$!

    echo "Starting frontend manually..."
    (
      cd "$ROOT_DIR/frontend/web"
      pnpm dev
    ) >/tmp/e2e-frontend.log 2>&1 &
    FRONTEND_PID=$!
  fi
fi

echo "Waiting for backend: ${BACKEND_URL}/v1/notebooks"
for _ in {1..60}; do
  if curl -fsS "${BACKEND_URL}/v1/notebooks" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "${BACKEND_URL}/v1/notebooks" >/dev/null 2>&1; then
  echo "Backend did not become ready. Check /tmp/overmind-e2e.log or /tmp/e2e-backend.log" >&2
  exit 1
fi

wait_for_frontend() {
  local url="$1"
  for _ in {1..60}; do
    if curl -fsS "${url}/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

echo "Waiting for frontend: ${FRONTEND_URL}/"
if ! wait_for_frontend "$FRONTEND_URL"; then
  if [[ -z "${E2E_BASE_URL:-}" ]]; then
    echo "Primary frontend URL not ready, trying fallback: ${FRONTEND_FALLBACK}/"
    if wait_for_frontend "$FRONTEND_FALLBACK"; then
      FRONTEND_URL="$FRONTEND_FALLBACK"
    else
      echo "Frontend did not become ready. Check /tmp/overmind-e2e.log or /tmp/e2e-frontend.log" >&2
      exit 1
    fi
  else
    echo "Frontend did not become ready. Check /tmp/overmind-e2e.log or /tmp/e2e-frontend.log" >&2
    exit 1
  fi
fi

echo "Seeding E2E notebook..."
(cd backend/py && E2E_API_URL="$BACKEND_URL" uv run scripts/e2e_seed.py)

echo "Running E2E live profile..."
(cd frontend/web && E2E_LIVE=1 E2E_BASE_URL="$FRONTEND_URL" E2E_LIVE_BASE_URL="$FRONTEND_URL" pnpm test:e2e --project=live)

echo "E2E run complete."
