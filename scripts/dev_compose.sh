#!/usr/bin/env bash
# Docker compose wrapper used by scripts/orchestrate.sh.
#
# Usage:
#   scripts/dev_compose.sh <mode> <action> [extra-args...]
#
# Modes:
#   prod   — uses deployments/prod/docker-compose.yml + optional overlays
#   deps   — uses deployments/dev/docker-compose.deps.yml + optional overlays
#
# Actions: up, down, ps, logs, rebuild <SERVICE>
#
# Environment variables (all optional):
#   ENV_FILE              — path to .env (default: .env, falls back to .env.example)
#   DEV_OPTIONALS         — space-separated overlay names (prod mode)
#   DEV_DEPS_OPTIONALS    — space-separated overlay names (deps mode)
#   DEV_DEPS_PROJECT      — compose project name (deps mode, default: crystalith-dev-deps)
#   DEV_BUILD             — set to 0/false/no/off to skip --build on "up" (prod mode)
#   APT_MIRROR / UV_INDEX_URL / NPM_REGISTRY — mirror overrides (prod mode)
#   CL_DEPS_SEARXNG_PORT  — searxng port for conflict detection (deps mode)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:?Usage: dev_compose.sh <prod|deps> <action> [args...]}"
ACTION="${2:?Usage: dev_compose.sh <prod|deps> <action> [args...]}"
shift 2

CHINA_APT_MIRROR="https://mirrors.tuna.tsinghua.edu.cn/debian"
CHINA_UV_INDEX_URL="https://mirrors.aliyun.com/pypi/simple/"
CHINA_NPM_REGISTRY="https://registry.npmmirror.com"

resolve_env_file() {
  local ef="${ENV_FILE:-.env}"
  if [[ ! -f "$ef" ]]; then
    ef=".env.example"
    echo "[${FUNCNAME[1]:-dev_compose}] ENV_FILE not found; using $ef (copy to .env to customize)."
  fi
  echo "$ef"
}

strip_leading_dashdash() {
  local -n arr=$1
  if [[ ${#arr[@]} -gt 0 && "${arr[0]}" == "--" ]]; then
    arr=("${arr[@]:1}")
  fi
}

build_file_list() {
  local core_file="$1"
  local optionals="$2"
  local overlay_prefix="$3"
  FILES=(-f "$core_file")
  for optional in $optionals; do
    FILES+=(-f "${overlay_prefix}${optional}.yml")
  done
}

ENV_FILE_RESOLVED="$(resolve_env_file)"
EXTRA_ARGS=("$@")
strip_leading_dashdash EXTRA_ARGS

case "$MODE" in
  prod)
    CORE_FILE="deployments/prod/docker-compose.yml"
    OPTIONALS="${DEV_OPTIONALS:-storage redis searxng}"
    build_file_list "$CORE_FILE" "$OPTIONALS" "deployments/prod/docker-compose."

    proxy_env=(
      -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u NO_PROXY
      -u http_proxy -u https_proxy -u all_proxy -u no_proxy
    )
    mirror_env=(
      APT_MIRROR="${APT_MIRROR:-$CHINA_APT_MIRROR}"
      UV_INDEX_URL="${UV_INDEX_URL:-$CHINA_UV_INDEX_URL}"
      NPM_REGISTRY="${NPM_REGISTRY:-$CHINA_NPM_REGISTRY}"
    )

    case "$ACTION" in
      up)
        bash ./scripts/ensure_rivu_submodule.sh
        BUILD_FLAG="--build"
        case "${DEV_BUILD:-1}" in 0|false|no|off) BUILD_FLAG="" ;; esac
        env "${proxy_env[@]}" "${mirror_env[@]}" \
          docker compose --env-file "$ENV_FILE_RESOLVED" "${FILES[@]}" up -d $BUILD_FLAG "${EXTRA_ARGS[@]}"
        ;;
      down)
        docker compose --env-file "$ENV_FILE_RESOLVED" "${FILES[@]}" down "${EXTRA_ARGS[@]}"
        ;;
      ps)
        docker compose --env-file "$ENV_FILE_RESOLVED" "${FILES[@]}" ps
        ;;
      logs)
        docker compose --env-file "$ENV_FILE_RESOLVED" "${FILES[@]}" logs -f "${EXTRA_ARGS[@]}"
        ;;
      rebuild)
        SERVICE="${EXTRA_ARGS[0]:?rebuild requires a SERVICE argument}"
        REMAINING=("${EXTRA_ARGS[@]:1}")
        bash ./scripts/ensure_rivu_submodule.sh
        env "${proxy_env[@]}" "${mirror_env[@]}" \
          docker compose --env-file "$ENV_FILE_RESOLVED" "${FILES[@]}" up -d --build --no-deps "$SERVICE" "${REMAINING[@]}"
        ;;
      *)
        echo "Unknown action for prod mode: $ACTION" >&2; exit 1 ;;
    esac
    ;;

  deps)
    CORE_FILE="deployments/dev/docker-compose.deps.yml"
    OPTIONALS="${DEV_DEPS_OPTIONALS:-storage redis searxng}"
    PROJECT="${DEV_DEPS_PROJECT:-crystalith-dev-deps}"

    if [[ "$ACTION" == "up" ]]; then
      FILES=(-f "$CORE_FILE")
      for optional in $OPTIONALS; do
        if [[ "$optional" == "searxng" ]]; then
          searxng_port="${CL_DEPS_SEARXNG_PORT:-50201}"
          if python -c 'import socket, sys; s=socket.socket(); s.settimeout(0.2); s.connect((sys.argv[1], int(sys.argv[2]))); s.close()' \
            "127.0.0.1" "$searxng_port" >/dev/null 2>&1
          then
            searxng_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${searxng_port}/search?q=&format=json" || true)"
            if [[ "$searxng_status" == "200" || "$searxng_status" == "400" ]]; then
              echo "[dev-deps-up] Detected existing searxng on :${searxng_port}; skipping deps overlay (searxng)."
              continue
            fi
            echo "[dev-deps-up] Port ${searxng_port} is already in use, but it does not look like a SearXNG instance." >&2
            echo "  - Stop the process using :${searxng_port}, or set CL_DEPS_SEARXNG_PORT to a free port, or remove 'searxng' from DEV_DEPS_OPTIONALS." >&2
            exit 1
          fi
        fi
        FILES+=(-f "deployments/dev/docker-compose.deps.${optional}.yml")
      done
      docker compose -p "$PROJECT" --env-file "$ENV_FILE_RESOLVED" "${FILES[@]}" up -d "${EXTRA_ARGS[@]}"
    else
      build_file_list "$CORE_FILE" "$OPTIONALS" "deployments/dev/docker-compose.deps."
      case "$ACTION" in
        down)
          docker compose -p "$PROJECT" --env-file "$ENV_FILE_RESOLVED" "${FILES[@]}" down "${EXTRA_ARGS[@]}"
          ;;
        ps)
          docker compose -p "$PROJECT" --env-file "$ENV_FILE_RESOLVED" "${FILES[@]}" ps
          ;;
        logs)
          docker compose -p "$PROJECT" --env-file "$ENV_FILE_RESOLVED" "${FILES[@]}" logs -f "${EXTRA_ARGS[@]}"
          ;;
        *)
          echo "Unknown action for deps mode: $ACTION" >&2; exit 1 ;;
      esac
    fi
    ;;

  *)
    echo "Unknown mode: $MODE (expected: prod|deps)" >&2; exit 1 ;;
esac
