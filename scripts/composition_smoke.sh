#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
WEB_PORT="${CL_WEB_PORT:-8080}"
BASE_URL="http://localhost:${WEB_PORT}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SMOKE_PRUNE_VOLUMES="${SMOKE_PRUNE_VOLUMES:-0}"
EXTERNAL_OLLAMA_HOST="${EXTERNAL_OLLAMA_HOST:-http://host.docker.internal:11434}"

CORE_FILE="deployments/prod/docker-compose.yml"
REDIS_FILE="deployments/prod/docker-compose.redis.yml"
STORAGE_FILE="deployments/prod/docker-compose.storage.yml"
OLLAMA_FILE="deployments/prod/docker-compose.ollama.yml"
SLIDEV_FILE="deployments/prod/docker-compose.slidev.yml"
HOST_REMAP_FILE="deployments/prod/docker-compose.host-remap.yml"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  WEB_PORT="${CL_WEB_PORT:-$WEB_PORT}"
  BASE_URL="http://localhost:${WEB_PORT}"
fi

compose() {
  docker compose --env-file "$ENV_FILE" "$@"
}

compose_core() {
  compose -f "$CORE_FILE" "$@"
}

compose_core_redis() {
  compose -f "$CORE_FILE" -f "$REDIS_FILE" "$@"
}

compose_reset() {
  local down_args=(down --remove-orphans)
  if [[ "$SMOKE_PRUNE_VOLUMES" == "1" ]]; then
    down_args+=(-v)
  fi

  compose \
    -f "$CORE_FILE" \
    -f "$STORAGE_FILE" \
    -f "$REDIS_FILE" \
    -f "$OLLAMA_FILE" \
    -f "$SLIDEV_FILE" \
    -f "$HOST_REMAP_FILE" \
    "${down_args[@]}" >/dev/null 2>&1 || true
}

up_flags=(-d)
if [[ "$SKIP_BUILD" != "1" ]]; then
  up_flags+=(--build)
fi

wait_http() {
  local url="$1"
  local timeout_s="${2:-120}"
  local start
  start="$(date +%s)"
  while true; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    if (( "$(date +%s)" - start >= timeout_s )); then
      echo "timeout waiting for ${url}" >&2
      return 1
    fi
    sleep 2
  done
}

assert_dependency_expr() {
  local expr="$1"
  curl -fsS "${BASE_URL}/health/dependencies" | python3 - "$expr" <<'PY'
import json
import sys

expr = sys.argv[1]
data = json.load(sys.stdin)
ok = eval(expr, {"__builtins__": {}}, {"data": data})
if not ok:
    raise SystemExit(f"assertion failed: {expr}")
PY
}

run_core_only() {
  echo "==> Scenario: core-only"
  compose_reset
  compose_core up "${up_flags[@]}"
  wait_http "${BASE_URL}/health"
  assert_dependency_expr "data['status'] == 'ok'"
  assert_dependency_expr "data['core']['backend']['healthy'] is True"
  assert_dependency_expr "'status' in data['optional']['storage_chroma']"
}

run_single_optional() {
  echo "==> Scenario: single-optional(redis)"
  compose_reset
  compose_core_redis up "${up_flags[@]}"
  wait_http "${BASE_URL}/health"
  assert_dependency_expr "data['optional']['cache_redis']['enabled'] is True"
}

run_late_optional() {
  echo "==> Scenario: optional-late-start(redis)"
  compose_reset
  compose_core up "${up_flags[@]}"
  wait_http "${BASE_URL}/health"

  compose_core_redis up -d redis

  local start
  start="$(date +%s)"
  while true; do
    if curl -fsS "${BASE_URL}/health/dependencies" | python3 - <<'PY'
import json
import sys

data = json.load(sys.stdin)
status = data["optional"]["cache_redis"]["status"]
raise SystemExit(0 if status == "healthy" else 1)
PY
    then
      break
    fi
    if (( "$(date +%s)" - start >= 120 )); then
      echo "timeout waiting redis optional status to become healthy" >&2
      return 1
    fi
    sleep 2
  done
}

run_external_service() {
  echo "==> Scenario: external-service(ollama-host)"
  compose_reset
  OLLAMA_HOST="$EXTERNAL_OLLAMA_HOST" compose_core up "${up_flags[@]}"
  wait_http "${BASE_URL}/health"
  OLLAMA_HOST="$EXTERNAL_OLLAMA_HOST" assert_dependency_expr "data['optional']['ollama']['enabled'] is True"
  OLLAMA_HOST="$EXTERNAL_OLLAMA_HOST" assert_dependency_expr "data['optional']['ollama']['endpoint'] == '$EXTERNAL_OLLAMA_HOST'"
}

SCENARIOS="${SMOKE_SCENARIOS:-core-only late-optional external-service}"
for scenario in $SCENARIOS; do
  case "$scenario" in
    core-only)
      run_core_only
      ;;
    single-optional)
      run_single_optional
      ;;
    late-optional)
      run_late_optional
      ;;
    external-service)
      run_external_service
      ;;
    *)
      echo "unknown scenario: $scenario" >&2
      exit 1
      ;;
  esac
done

echo "==> All composition smoke scenarios passed."
