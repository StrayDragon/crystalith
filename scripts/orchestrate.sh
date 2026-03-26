#!/usr/bin/env bash
# Unified orchestrator for all Crystalith runtime profiles.
#
# Usage:
#   scripts/orchestrate.sh <action> [profile] [extra-args...]
#
# Actions: up, down, status, logs
#
# Profiles (override via CLI arg or CRYSTALITH_PROFILE in .env):
#   local   — Pure local dev: overmind starts frontend + backend, no Docker.
#   hybrid  — Docker deps (Postgres/Chroma/Redis/SearXNG) + local hot-reload app. (default)
#   docker  — Docker Compose for app + selected deps; remaining services connect externally.
#   full    — Full Docker Compose deployment with all optional overlays.
#
# Environment variables (all optional):
#   CRYSTALITH_PROFILE    — default profile when CLI arg is omitted (default: hybrid)
#   HYBRID_SERVICES       — space-separated dep overlays for hybrid mode (default: storage redis searxng)
#   DOCKER_SERVICES       — space-separated compose overlays for docker mode (default: storage redis searxng)
#   FULL_SERVICES         — space-separated compose overlays for full mode (default: storage redis searxng ollama slidev)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Source .env for CRYSTALITH_PROFILE and other vars (ignore missing).
# Uses grep+eval to safely handle values with spaces (e.g. BRIDGE_FORWARDS).
_source_env_file() {
  local ef="$1"
  [[ -f "$ef" ]] || return 0
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    local key="${line%%=*}"
    local val="${line#*=}"
    # Align with config template rendering: .env overrides existing process env.
    export "$key=$val"
  done < "$ef"
}

if [[ -f .env ]]; then
  _source_env_file .env
elif [[ -f .env.example ]]; then
  _source_env_file .env.example
fi

ACTION="${1:?Usage: orchestrate.sh <up|down|status|logs> [profile] [extra-args...]}"
PROFILE="${2:-${CRYSTALITH_PROFILE:-hybrid}}"
shift 2 2>/dev/null || shift $# 2>/dev/null || true
EXTRA_ARGS=("$@")

HYBRID_SERVICES="${HYBRID_SERVICES:-storage redis searxng}"
DOCKER_SERVICES="${DOCKER_SERVICES:-storage redis searxng}"
FULL_SERVICES="${FULL_SERVICES:-storage redis searxng ollama slidev}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

info()  { echo -e "\033[1;34m[orchestrate]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[orchestrate]\033[0m $*" >&2; }
error() { echo -e "\033[1;31m[orchestrate]\033[0m $*" >&2; exit 1; }

check_command() {
  if ! command -v "$1" &>/dev/null; then
    error "'$1' is required but not found. Please install it first."
  fi
}

_has_service() {
  local needle="$1"; shift
  for s in "$@"; do [[ "$s" == "$needle" ]] && return 0; done
  return 1
}

wait_for_deps() {
  local services="$1"
  local postgres_port="${CL_DEPS_POSTGRES_PORT:-5434}"
  local chroma_port="${CL_DEPS_CHROMA_PORT:-8001}"
  local redis_port="${CL_DEPS_REDIS_PORT:-6380}"
  local searxng_port="${CL_DEPS_SEARXNG_PORT:-50201}"

  # shellcheck disable=SC2086
  if _has_service storage $services; then
    info "Waiting for Postgres (:$postgres_port) ..."
    bash ./scripts/wait_ready.sh tcp 127.0.0.1 "$postgres_port" 120
    info "Waiting for ChromaDB (:$chroma_port) ..."
    bash ./scripts/wait_ready.sh http "http://127.0.0.1:${chroma_port}/api/v1/heartbeat" 120
  fi
  # shellcheck disable=SC2086
  if _has_service redis $services; then
    info "Waiting for Redis (:$redis_port) ..."
    bash ./scripts/wait_ready.sh tcp 127.0.0.1 "$redis_port" 60
  fi
  # shellcheck disable=SC2086
  if _has_service searxng $services; then
    info "Waiting for SearXNG (:$searxng_port) ..."
    bash ./scripts/wait_ready.sh searxng "$searxng_port" 60
  fi
}

# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

do_up() {
  case "$PROFILE" in
    local)
      check_command overmind
      info "Profile: local — starting app via overmind (no Docker)"
      export CRYSTALITH_ENV=local
      exec overmind start -f Procfile "${EXTRA_ARGS[@]}"
      ;;

    hybrid)
      check_command overmind
      check_command docker
      info "Profile: hybrid — Docker deps ($HYBRID_SERVICES) + local app"
      export CRYSTALITH_ENV=hybrid

      DEV_DEPS_OPTIONALS="$HYBRID_SERVICES" \
        bash ./scripts/dev_compose.sh deps up "${EXTRA_ARGS[@]}"

      wait_for_deps "$HYBRID_SERVICES"

      info "Starting app via overmind ..."
      exec overmind start -f Procfile
      ;;

    docker)
      check_command docker
      info "Profile: docker — Docker Compose with overlays: $DOCKER_SERVICES"
      export CRYSTALITH_ENV=docker

      DEV_OPTIONALS="$DOCKER_SERVICES" \
        bash ./scripts/dev_compose.sh prod up "${EXTRA_ARGS[@]}"
      ;;

    full)
      check_command docker
      info "Profile: full — Full Docker Compose ($FULL_SERVICES)"
      export CRYSTALITH_ENV=docker

      DEV_OPTIONALS="$FULL_SERVICES" \
        bash ./scripts/dev_compose.sh prod up "${EXTRA_ARGS[@]}"
      ;;

    *)
      error "Unknown profile: $PROFILE (expected: local|hybrid|docker|full)"
      ;;
  esac
}

do_down() {
  case "$PROFILE" in
    local)
      if command -v overmind &>/dev/null; then
        info "Stopping overmind ..."
        overmind quit 2>/dev/null || true
      fi
      ;;

    hybrid)
      if command -v overmind &>/dev/null; then
        info "Stopping overmind ..."
        overmind quit 2>/dev/null || true
      fi
      info "Stopping Docker deps ..."
      DEV_DEPS_OPTIONALS="$HYBRID_SERVICES" \
        bash ./scripts/dev_compose.sh deps down "${EXTRA_ARGS[@]}"
      ;;

    docker)
      DEV_OPTIONALS="$DOCKER_SERVICES" \
        bash ./scripts/dev_compose.sh prod down "${EXTRA_ARGS[@]}"
      ;;

    full)
      DEV_OPTIONALS="$FULL_SERVICES" \
        bash ./scripts/dev_compose.sh prod down "${EXTRA_ARGS[@]}"
      ;;

    *)
      error "Unknown profile: $PROFILE"
      ;;
  esac
}

do_status() {
  case "$PROFILE" in
    local)
      if command -v overmind &>/dev/null; then
        overmind ps 2>/dev/null || info "overmind is not running"
      fi
      ;;

    hybrid)
      if command -v overmind &>/dev/null; then
        info "=== App processes ==="
        overmind ps 2>/dev/null || info "overmind is not running"
      fi
      info "=== Docker deps ==="
      DEV_DEPS_OPTIONALS="$HYBRID_SERVICES" \
        bash ./scripts/dev_compose.sh deps ps
      ;;

    docker)
      DEV_OPTIONALS="$DOCKER_SERVICES" \
        bash ./scripts/dev_compose.sh prod ps
      ;;

    full)
      DEV_OPTIONALS="$FULL_SERVICES" \
        bash ./scripts/dev_compose.sh prod ps
      ;;

    *)
      error "Unknown profile: $PROFILE"
      ;;
  esac
}

do_logs() {
  case "$PROFILE" in
    local)
      warn "Use 'overmind connect <process>' for local logs."
      ;;

    hybrid)
      info "Docker deps logs:"
      DEV_DEPS_OPTIONALS="$HYBRID_SERVICES" \
        bash ./scripts/dev_compose.sh deps logs "${EXTRA_ARGS[@]}"
      ;;

    docker)
      DEV_OPTIONALS="$DOCKER_SERVICES" \
        bash ./scripts/dev_compose.sh prod logs "${EXTRA_ARGS[@]}"
      ;;

    full)
      DEV_OPTIONALS="$FULL_SERVICES" \
        bash ./scripts/dev_compose.sh prod logs "${EXTRA_ARGS[@]}"
      ;;

    *)
      error "Unknown profile: $PROFILE"
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

case "$ACTION" in
  up)     do_up     ;;
  down)   do_down   ;;
  status) do_status ;;
  logs)   do_logs   ;;
  *)      error "Unknown action: $ACTION (expected: up|down|status|logs)" ;;
esac
