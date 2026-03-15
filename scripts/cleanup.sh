#!/usr/bin/env bash
# Detect and optionally clean up stale artifacts from the old dev workflow.
#
# Usage:
#   just cleanup            # dry-run: scan and report only
#   just cleanup --apply    # execute cleanup actions
#
# Checks:
#   1. Obsolete .env variables (DEV_OPTIONALS, DEV_DEPS_OPTIONALS, etc.)
#   2. Orphan Docker containers from old project names (crystalith-dev-deps-*)
#   3. Orphan Docker volumes from old project names
#   4. Stale empty directories under data/
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

issues=0

info()  { echo -e "\033[1;34m[cleanup]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[cleanup]\033[0m $*"; }
ok()    { echo -e "\033[1;32m[cleanup]\033[0m $*"; }
err()   { echo -e "\033[1;31m[cleanup]\033[0m $*"; }
action(){ echo -e "\033[1;35m[action]\033[0m  $*"; }

# ---------------------------------------------------------------------------
# 1. Obsolete .env variables
# ---------------------------------------------------------------------------

OBSOLETE_ENV_VARS=(
  "DEV_OPTIONALS"
  "DEV_DEPS_OPTIONALS"
  "DEV_DEPS_PROJECT"
  "DEV_DEPS_CORE_FILE"
  "COMPOSE_CORE_FILE"
)

MIGRATION_MAP=(
  "DEV_OPTIONALS -> DOCKER_SERVICES (in .env)"
  "DEV_DEPS_OPTIONALS -> HYBRID_SERVICES (in .env)"
  "DEV_DEPS_PROJECT -> (no longer needed, orchestrate.sh handles it)"
  "DEV_DEPS_CORE_FILE -> (no longer needed)"
  "COMPOSE_CORE_FILE -> (no longer needed)"
)

check_obsolete_env_vars() {
  local env_file=".env"
  [[ -f "$env_file" ]] || return 0

  info "Checking .env for obsolete variables..."
  local i=0
  for var in "${OBSOLETE_ENV_VARS[@]}"; do
    if grep -q "^${var}=" "$env_file" 2>/dev/null; then
      warn "  Found obsolete variable: ${var}"
      warn "    Migration: ${MIGRATION_MAP[$i]}"
      issues=$((issues + 1))
      if $APPLY; then
        sed -i "/^${var}=/d" "$env_file"
        action "Removed ${var} from .env"
      fi
    fi
    i=$((i + 1))
  done
}

# ---------------------------------------------------------------------------
# 2. Orphan Docker containers (old project names)
# ---------------------------------------------------------------------------

OLD_PROJECT_PREFIXES=(
  "crystalith-dev-deps"
)

check_orphan_containers() {
  command -v docker &>/dev/null || return 0

  info "Checking for orphan Docker containers..."
  for prefix in "${OLD_PROJECT_PREFIXES[@]}"; do
    local containers
    containers="$(docker ps -a --filter "name=^${prefix}" --format '{{.Names}}' 2>/dev/null || true)"
    if [[ -n "$containers" ]]; then
      while IFS= read -r name; do
        warn "  Orphan container: ${name}"
        issues=$((issues + 1))
        if $APPLY; then
          docker rm -f "$name" >/dev/null 2>&1 || true
          action "Removed container: ${name}"
        fi
      done <<< "$containers"
    fi
  done
}

# ---------------------------------------------------------------------------
# 3. Orphan Docker volumes (old project names)
# ---------------------------------------------------------------------------

check_orphan_volumes() {
  command -v docker &>/dev/null || return 0

  info "Checking for orphan Docker volumes..."
  for prefix in "${OLD_PROJECT_PREFIXES[@]}"; do
    local volumes
    volumes="$(docker volume ls --filter "name=^${prefix}" --format '{{.Name}}' 2>/dev/null || true)"
    if [[ -n "$volumes" ]]; then
      while IFS= read -r vol; do
        warn "  Orphan volume: ${vol}"
        issues=$((issues + 1))
        if $APPLY; then
          docker volume rm "$vol" >/dev/null 2>&1 || true
          action "Removed volume: ${vol}"
        fi
      done <<< "$volumes"
    fi
  done
}

# ---------------------------------------------------------------------------
# 4. Stale empty directories under data/
# ---------------------------------------------------------------------------

check_stale_data_dirs() {
  [[ -d "data" ]] || return 0

  info "Checking for empty directories under data/..."
  while IFS= read -r dir; do
    warn "  Empty directory: ${dir}"
    issues=$((issues + 1))
    if $APPLY; then
      rmdir "$dir" 2>/dev/null || true
      action "Removed empty directory: ${dir}"
    fi
  done < <(find data -mindepth 1 -type d -empty 2>/dev/null || true)
}

# ---------------------------------------------------------------------------
# 5. Old justfile references in user shell history (informational only)
# ---------------------------------------------------------------------------

check_old_command_hints() {
  info "Checking for common migration reminders..."

  local old_cmds=(
    "just dev"
    "just dev-deps-up"
    "just dev-deps-down"
    "just dev-docker-up"
    "just dev-docker-down"
    "just dev-docker-ps"
    "just dev-docker-logs"
    "just dev-docker-rebuild"
    "just dev-backend"
  )
  local new_cmds=(
    "just up hybrid"
    "just up hybrid"
    "just down hybrid"
    "just up docker"
    "just down docker"
    "just status docker"
    "just logs docker"
    "(use docker compose directly or just up docker --build)"
    "(handled by just up hybrid internally)"
  )

  echo ""
  info "Command migration reference:"
  for i in "${!old_cmds[@]}"; do
    echo "    ${old_cmds[$i]}  ->  ${new_cmds[$i]}"
  done
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

echo ""
if $APPLY; then
  info "Running cleanup (--apply mode)..."
else
  info "Running cleanup (dry-run, use --apply to execute)..."
fi
echo ""

check_obsolete_env_vars
check_orphan_containers
check_orphan_volumes
check_stale_data_dirs
check_old_command_hints

echo ""
if [[ "$issues" -eq 0 ]]; then
  ok "No issues found. Environment is clean."
else
  if $APPLY; then
    ok "Cleaned up ${issues} issue(s)."
  else
    warn "Found ${issues} issue(s). Run 'just cleanup --apply' to fix."
  fi
fi
