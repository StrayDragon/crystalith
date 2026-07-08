#!/usr/bin/env bash
# Initialize or update local config files from environment variables.
#
# Writes well-known env vars from the user's shell into:
#   .env              — build/run parameters
#   config/secret.env — runtime secrets for config/app.yaml template rendering
#
# Existing values are preserved (env vars only fill in blanks).
# Run via: just upsert-env-configs
#
# Recognized env vars (all optional):
#   .env targets:
#     OPENAI_BASE_URL                — OpenAI-compatible API base URL
#     OPENAI_API_KEY                 — OpenAI API key
#     ANTHROPIC_API_KEY              — Anthropic API key
#     GOOGLE_GENERATIVE_AI_API_KEY   — Google AI API key
#     CRYSTALITH_DEFAULT_CHAT_MODEL  — default chat model ID
#     CRYSTALITH_DEFAULT_EMBEDDING_MODEL — default embedding model ID
#   config/secret.env targets:
#     OPENAI_API_KEY                 — OpenAI API key
#     ANTHROPIC_API_KEY              — Anthropic API key
#     GOOGLE_GENERATIVE_AI_API_KEY   — Google AI API key
#     JINA_API_KEY                   — Jina Reader API key
#     FIRECRAWL_API_KEY              — Firecrawl API key
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

  _set_env_var "OPENAI_BASE_URL"     "OPENAI_BASE_URL" "${OPENAI_BASE_URL:-}"
  _set_env_var "CRYSTALITH_DEFAULT_EMBEDDING_MODEL" "CRYSTALITH_DEFAULT_EMBEDDING_MODEL" "${CRYSTALITH_DEFAULT_EMBEDDING_MODEL:-}"
  _set_env_var "CRYSTALITH_DEFAULT_CHAT_MODEL" "CRYSTALITH_DEFAULT_CHAT_MODEL" "${CRYSTALITH_DEFAULT_CHAT_MODEL:-}"
}

_set_env_var() {
  local value="$3"
  [[ -z "$value" ]] && return 0
  local target_key="$2"
  local source_name="$1"

  if grep -q "^${target_key}=" "$ENV_FILE" 2>/dev/null; then
    local existing
    existing="$(grep "^${target_key}=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
    if [[ -n "$existing" ]]; then
      return 0
    fi
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
# Crystalith secrets — auto-generated.
# This file is gitignored. Do NOT commit.
ENV
      info "Created $SECRET_ENV_FILE"
    fi
  else
    info "$SECRET_ENV_FILE already exists, updating..."
  fi

  _set_secret_env "OPENAI_API_KEY"      "${OPENAI_API_KEY:-}"
  _set_secret_env "ANTHROPIC_API_KEY"   "${ANTHROPIC_API_KEY:-}"
  _set_secret_env "GOOGLE_GENERATIVE_AI_API_KEY" "${GOOGLE_GENERATIVE_AI_API_KEY:-}"
  _set_secret_env "JINA_API_KEY"        "${JINA_API_KEY:-}"
  _set_secret_env "FIRECRAWL_API_KEY"   "${FIRECRAWL_API_KEY:-}"
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

info "Initializing local config from environment variables..."
echo ""

init_env_file
echo ""
init_secret_env_file

echo ""
info "Summary:"
echo "  .env              — build/run parameters"
echo "  config/secret.env — runtime secrets"
echo ""

detected=0
for var in OPENAI_BASE_URL OPENAI_API_KEY ANTHROPIC_API_KEY \
           GOOGLE_GENERATIVE_AI_API_KEY JINA_API_KEY FIRECRAWL_API_KEY; do
  if [[ -n "${!var:-}" ]]; then
    ok "  \$$var detected"
    detected=$((detected + 1))
  fi
done

if [[ "$detected" -eq 0 ]]; then
  warn "  No API keys detected. Set them in your shell profile and re-run,"
  warn "  or edit .env and config/secret.env manually."
fi

echo ""
ok "Done."
