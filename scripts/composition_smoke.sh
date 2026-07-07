#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
WEB_PORT="${CL_WEB_PORT:-8080}"
BASE_URL="http://localhost:${WEB_PORT}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SMOKE_PRUNE_VOLUMES="${SMOKE_PRUNE_VOLUMES:-0}"

CORE_FILE="deployments/prod/docker-compose.yml"
REDIS_FILE="deployments/prod/docker-compose.redis.yml"
STORAGE_FILE="deployments/prod/docker-compose.storage.yml"
SLIDEV_FILE="deployments/prod/docker-compose.slidev.yml"
HOST_REMAP_FILE="deployments/prod/docker-compose.host-remap.yml"

if [[ "$ENV_FILE" == ".env" && ! -f "$ENV_FILE" && -f ".env.example" ]]; then
  ENV_FILE=".env.example"
fi

if [[ -f "$ENV_FILE" ]]; then
  # Do NOT `source` compose env files: they are not guaranteed to be valid shell.
  # Parse only the keys we need.
  ENV_WEB_PORT="$(python3 - "$ENV_FILE" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
value = None
for raw in path.read_text().splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, val = line.split("=", 1)
    if key.strip() != "CL_WEB_PORT":
        continue
    value = val.strip().strip('"').strip("'")
    break
print(value or "")
PY
  )"
  if [[ -n "$ENV_WEB_PORT" ]]; then
    WEB_PORT="$ENV_WEB_PORT"
    BASE_URL="http://localhost:${WEB_PORT}"
  fi
fi

bash ./scripts/ensure_rivu_submodule.sh

compose() {
  env \
    -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u NO_PROXY \
    -u http_proxy -u https_proxy -u all_proxy -u no_proxy \
    docker compose --env-file "$ENV_FILE" "$@"
}

compose_core() {
  compose -f "$CORE_FILE" "$@"
}

compose_core_redis() {
  compose -f "$CORE_FILE" -f "$REDIS_FILE" "$@"
}

compose_core_key_optionals() {
  compose -f "$CORE_FILE" -f "$STORAGE_FILE" -f "$REDIS_FILE" "$@"
}

compose_core_all_optionals() {
  compose -f "$CORE_FILE" -f "$STORAGE_FILE" -f "$REDIS_FILE" -f "$SLIDEV_FILE" "$@"
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
  curl -fsS "${BASE_URL}/health/dependencies" | python3 -c '
import json
import sys

expr = sys.argv[1]
data = json.load(sys.stdin)
ok = eval(expr, {"__builtins__": {}}, {"data": data})
if not ok:
    raise SystemExit(f"assertion failed: {expr}")
' "$expr"
}

assert_json_expr() {
  local url="$1"
  local expr="$2"
  curl -fsS "$url" | python3 -c '
import json
import sys

expr = sys.argv[1]
data = json.load(sys.stdin)
safe_globals = {"__builtins__": {}}
safe_locals = {"data": data, "any": any, "all": all, "len": len, "next": next}
ok = eval(expr, safe_globals, safe_locals)
if not ok:
    raise SystemExit(f"assertion failed: {expr}")
' "$expr"
}

wait_json_expr() {
  local url="$1"
  local expr="$2"
  local timeout_s="${3:-120}"
  local start
  start="$(date +%s)"
  while true; do
    if assert_json_expr "$url" "$expr" >/dev/null 2>&1; then
      return 0
    fi
    if (( "$(date +%s)" - start >= timeout_s )); then
      echo "timeout waiting for JSON assertion: ${expr} (${url})" >&2
      curl -fsS "$url" | python3 -m json.tool | head -120 >&2 || true
      return 1
    fi
    sleep 2
  done
}

wait_dependency_expr() {
  local expr="$1"
  local timeout_s="${2:-120}"
  local start
  start="$(date +%s)"
  while true; do
    if assert_dependency_expr "$expr" >/dev/null 2>&1; then
      return 0
    fi
    if (( "$(date +%s)" - start >= timeout_s )); then
      echo "timeout waiting for dependency assertion: ${expr}" >&2
      curl -fsS "${BASE_URL}/health/dependencies" | python3 -m json.tool | head -120 >&2 || true
      return 1
    fi
    sleep 2
  done
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
  wait_dependency_expr "data['optional']['cache_redis']['enabled'] is True"
  wait_dependency_expr "data['optional']['cache_redis']['status'] == 'healthy'"
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
    if curl -fsS "${BASE_URL}/health/dependencies" | python3 -c '
import json
import sys

data = json.load(sys.stdin)
status = data["optional"]["cache_redis"]["status"]
raise SystemExit(0 if status == "healthy" else 1)
'
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

run_key_optionals() {
  echo "==> Scenario: key-optionals(storage+redis)"
  compose_reset
  compose_core_key_optionals up "${up_flags[@]}"
  wait_http "${BASE_URL}/health"
  wait_dependency_expr "data['optional']['storage_chroma']['enabled'] is True"
  wait_dependency_expr "data['optional']['cache_redis']['enabled'] is True"
  wait_dependency_expr "data['optional']['storage_chroma']['status'] != 'unknown'"
  wait_dependency_expr "data['optional']['cache_redis']['status'] != 'unknown'"
}

run_all_optionals() {
  echo "==> Scenario: all-optionals(storage+redis+slidev)"
  compose_reset
  compose_core_all_optionals up "${up_flags[@]}"
  wait_http "${BASE_URL}/health"
  wait_dependency_expr "data['optional']['storage_chroma']['enabled'] is True"
  wait_dependency_expr "data['optional']['cache_redis']['enabled'] is True"
  wait_http "${BASE_URL}/slidev/"
  wait_json_expr "${BASE_URL}/v1/workspace/tools" "any(tool.get('output_type') == 'SLIDES' for tool in data['tools'])"
  wait_json_expr "${BASE_URL}/v1/workspace/tools" "data['diagnostics']['slides']['active_plugin_id'] == 'slides-slidev'"
  wait_json_expr "${BASE_URL}/v1/workspace/tools" "data['diagnostics']['official']['slides-slidev'].get('status') != 'not_installed'"
  wait_json_expr "${BASE_URL}/v1/workspace/tools" "next(tool for tool in data['tools'] if tool.get('output_type') == 'SLIDES')['config_schema']['preview']['service'] == 'slidev'"
}

SCENARIOS="${SMOKE_SCENARIOS:-core-only late-optional}"
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
    key-optionals)
      run_key_optionals
      ;;
    all-optionals)
      run_all_optionals
      ;;
    *)
      echo "unknown scenario: $scenario" >&2
      exit 1
      ;;
  esac
done

echo "==> All composition smoke scenarios passed."
