#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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
fi

echo "Waiting for backend: ${BACKEND_URL}/v1/notebooks"
for _ in {1..60}; do
  if curl -fsS "${BACKEND_URL}/v1/notebooks" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "${BACKEND_URL}/v1/notebooks" >/dev/null 2>&1; then
  echo "Backend did not become ready. Check /tmp/overmind-e2e.log" >&2
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
      echo "Frontend did not become ready. Check /tmp/overmind-e2e.log" >&2
      exit 1
    fi
  else
    echo "Frontend did not become ready. Check /tmp/overmind-e2e.log" >&2
    exit 1
  fi
fi

echo "Seeding E2E notebook..."
(cd backend/py && E2E_API_URL="$BACKEND_URL" uv run scripts/e2e_seed.py)

echo "Running E2E mock profile..."
(cd frontend/web && pnpm test:e2e --project=mock)

echo "Running E2E live profile..."
(cd frontend/web && E2E_LIVE=1 E2E_BASE_URL="$FRONTEND_URL" E2E_LIVE_BASE_URL="$FRONTEND_URL" pnpm test:e2e --project=live)

echo "E2E run complete."
