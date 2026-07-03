#!/usr/bin/env bash
# Initialize or update local config files from environment variables.
#
# Reads well-known env vars from the user's shell and writes them into:
#   .env              — compose/build parameters
#   config/secret.env — runtime secrets for config/app.yaml template rendering
#
# Existing values are preserved (env vars only fill in blanks).
# Run via: just upsert-env-configs
#
# Recognized env vars (all optional):
#
#   .env targets:
#     CRYSTALITH_PROFILE             — runtime profile (local|hybrid|docker|full)
#     OPENAI_BASE_URL                — OpenAI-compatible API base URL
#     CRYSTALITH_DEFAULT_EMBEDDING_MODEL — default embedding model ID (e.g. gateway-embedding)
#     CRYSTALITH_DEFAULT_CHAT_MODEL  — default chat model ID (e.g. gateway-chat-primary | gateway-chat-light)
#     OMLX_OPENAI_API_BASE           — OMLX gateway base URL
#     OMLX_OPENAI_API_KEY            — OMLX gateway API key
#     OMLX_OPENAI_DEFAULT_EMBEDDING_MODEL — OMLX embedding model name
#     OMLX_OPENAI_DEFAULT_CHAT_MODEL — OMLX chat model name
#     TUFA_OPENAI_API_HOST           — TUFA gateway base URL
#     TUFA_OPENAI_API_KEY            — TUFA gateway API key
#     TUFA_OPENAI_DEFAULT_CHATMODEL  — TUFA chat model name
#     BRIDGE_FORWARDS                — host-remap bridge forwards
#
#   config/secret.env targets (optional Docker deployments only):
#     OPENAI_API_KEY                 — legacy; prefer export in shell / .env
#     POSTGRES_PASSWORD              — PostgreSQL password
#     CRYSTALITH_API_KEY             — Crystalith auth API key
#     JINA_API_KEY                   — Jina Reader API key
#     FIRECRAWL_API_KEY              — Firecrawl API key
#     BROWSERLESS_TOKEN              — Browserless token
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

info()  { echo -e "\033[1;34m[init]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[init]\033[0m $*"; }
ok()    { echo -e "\033[1;32m[init]\033[0m $*"; }

# ---------------------------------------------------------------------------
# .env initialization
# ---------------------------------------------------------------------------

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

init_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "$ENV_EXAMPLE" ]]; then
      cp "$ENV_EXAMPLE" "$ENV_FILE"
      info "Created $ENV_FILE from $ENV_EXAMPLE"
    else
      touch "$ENV_FILE"
      info "Created empty $ENV_FILE"
    fi
  else
    info "$ENV_FILE already exists, updating..."
  fi

  # Map: SHELL_ENV_VAR -> .env key [-> transform]
  _set_env_var "CRYSTALITH_PROFILE"  "CRYSTALITH_PROFILE"  "${CRYSTALITH_PROFILE:-}"
  _set_env_var "OPENAI_BASE_URL"     "OPENAI_BASE_URL" "${OPENAI_BASE_URL:-}"
  _set_env_var "CRYSTALITH_DEFAULT_EMBEDDING_MODEL" "CRYSTALITH_DEFAULT_EMBEDDING_MODEL" "${CRYSTALITH_DEFAULT_EMBEDDING_MODEL:-}"
  _set_env_var "CRYSTALITH_DEFAULT_CHAT_MODEL" "CRYSTALITH_DEFAULT_CHAT_MODEL" "${CRYSTALITH_DEFAULT_CHAT_MODEL:-}"
  _set_env_var "OMLX_OPENAI_API_BASE" "OMLX_OPENAI_API_BASE" "${OMLX_OPENAI_API_BASE:-}"
  _set_env_var "OMLX_OPENAI_API_KEY" "OMLX_OPENAI_API_KEY" "${OMLX_OPENAI_API_KEY:-}"
  _set_env_var "OMLX_OPENAI_DEFAULT_EMBEDDING_MODEL" "OMLX_OPENAI_DEFAULT_EMBEDDING_MODEL" "${OMLX_OPENAI_DEFAULT_EMBEDDING_MODEL:-}"
  _set_env_var "OMLX_OPENAI_DEFAULT_CHAT_MODEL" "OMLX_OPENAI_DEFAULT_CHAT_MODEL" "${OMLX_OPENAI_DEFAULT_CHAT_MODEL:-}"
  _set_env_var "TUFA_OPENAI_API_HOST" "TUFA_OPENAI_API_HOST" "${TUFA_OPENAI_API_HOST:-}"
  _set_env_var "TUFA_OPENAI_API_KEY" "TUFA_OPENAI_API_KEY" "${TUFA_OPENAI_API_KEY:-}"
  _set_env_var "TUFA_OPENAI_DEFAULT_CHATMODEL" "TUFA_OPENAI_DEFAULT_CHATMODEL" "${TUFA_OPENAI_DEFAULT_CHATMODEL:-}"
  _set_env_var "BRIDGE_FORWARDS"     "BRIDGE_FORWARDS"     "${BRIDGE_FORWARDS:-}"
}

_set_env_var() {
  local source_name="$1"
  local target_key="$2"
  local value="$3"

  [[ -z "$value" ]] && return 0

  if grep -q "^${target_key}=" "$ENV_FILE" 2>/dev/null; then
    local existing
    existing="$(grep "^${target_key}=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
    if [[ -n "$existing" ]]; then
      return 0
    fi
    # Replace empty value with env var value
    sed -i "s|^${target_key}=.*|${target_key}=${value}|" "$ENV_FILE"
    ok "  $ENV_FILE: ${target_key} <- \$${source_name}"
  else
    echo "${target_key}=${value}" >> "$ENV_FILE"
    ok "  $ENV_FILE: ${target_key} <- \$${source_name} (appended)"
  fi
}

# ---------------------------------------------------------------------------
# config/secret.env initialization
# ---------------------------------------------------------------------------

SECRET_ENV_FILE="config/secret.env"
SECRET_ENV_EXAMPLE="config/secret.env.example"

init_secret_env_file() {
  if [[ ! -f "$SECRET_ENV_FILE" ]]; then
    mkdir -p config
    if [[ -f "$SECRET_ENV_EXAMPLE" ]]; then
      cp "$SECRET_ENV_EXAMPLE" "$SECRET_ENV_FILE"
      info "Created $SECRET_ENV_FILE from $SECRET_ENV_EXAMPLE"
    else
      cat > "$SECRET_ENV_FILE" <<'ENV'
# Crystalith secrets — auto-generated by `just upsert-env-configs`.
# This file is gitignored. Do NOT commit.
# Re-run `just upsert-env-configs` to update from environment variables.
ENV
      info "Created $SECRET_ENV_FILE"
    fi
  else
    info "$SECRET_ENV_FILE already exists, updating..."
  fi

  _set_secret_env "OPENAI_API_KEY"      "${OPENAI_API_KEY:-}"
  _set_secret_env "POSTGRES_PASSWORD"   "${POSTGRES_PASSWORD:-}"
  _set_secret_env "CRYSTALITH_API_KEY"  "${CRYSTALITH_API_KEY:-}"
  _set_secret_env "JINA_API_KEY"        "${JINA_API_KEY:-}"
  _set_secret_env "FIRECRAWL_API_KEY"   "${FIRECRAWL_API_KEY:-}"
  _set_secret_env "BROWSERLESS_TOKEN"   "${BROWSERLESS_TOKEN:-}"
}

_set_secret_env() {
  local key="$1"
  local value="$2"

  [[ -z "$value" ]] && return 0

  if grep -q "^${key}=" "$SECRET_ENV_FILE" 2>/dev/null; then
    local existing
    existing="$(grep "^${key}=" "$SECRET_ENV_FILE" | head -1 | cut -d= -f2-)"
    if [[ -n "$existing" ]]; then
      return 0
    fi
    sed -i "s|^${key}=.*|${key}=${value}|" "$SECRET_ENV_FILE"
    ok "  $SECRET_ENV_FILE: ${key} <- \$${key}"
  else
    echo "${key}=${value}" >> "$SECRET_ENV_FILE"
    ok "  $SECRET_ENV_FILE: ${key} <- \$${key} (appended)"
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

_check_obsolete_env_vars() {
  local env_file=".env"
  [[ -f "$env_file" ]] || return 0
  local found=0
  for var in DEV_OPTIONALS DEV_DEPS_OPTIONALS DEV_DEPS_PROJECT DEV_DEPS_CORE_FILE COMPOSE_CORE_FILE; do
    if grep -q "^${var}=" "$env_file" 2>/dev/null; then
      found=1
      break
    fi
  done
  if [[ "$found" -eq 1 ]]; then
    warn "Your .env contains obsolete variables from the old dev workflow."
    warn "Run 'just cleanup' to detect and migrate them."
    echo ""
  fi
}

info "Initializing local config from environment variables..."
echo ""

_check_obsolete_env_vars
init_env_file
echo ""
init_secret_env_file

echo ""
info "Summary:"
echo "  .env              — compose/build parameters"
echo "  config/secret.env — runtime secrets"
echo ""

# Show what was detected
detected=0
for var in CRYSTALITH_PROFILE OPENAI_BASE_URL OPENAI_API_KEY CRYSTALITH_DEFAULT_EMBEDDING_MODEL \
           CRYSTALITH_DEFAULT_CHAT_MODEL OMLX_OPENAI_API_BASE OMLX_OPENAI_API_KEY \
           OMLX_OPENAI_DEFAULT_EMBEDDING_MODEL OMLX_OPENAI_DEFAULT_CHAT_MODEL \
           TUFA_OPENAI_API_HOST TUFA_OPENAI_API_KEY TUFA_OPENAI_DEFAULT_CHATMODEL \
           POSTGRES_PASSWORD CRYSTALITH_API_KEY JINA_API_KEY FIRECRAWL_API_KEY BROWSERLESS_TOKEN \
           BRIDGE_FORWARDS; do
  if [[ -n "${!var:-}" ]]; then
    ok "  \$$var detected"
    detected=$((detected + 1))
  fi
done

if [[ "$detected" -eq 0 ]]; then
  warn "  No env vars detected. Set them in your shell profile (~/.bashrc, ~/.zshrc, etc.)"
  warn "  and re-run 'just upsert-env-configs', or edit the files manually."
fi

echo ""
ok "Done. Run 'just up' to start."
