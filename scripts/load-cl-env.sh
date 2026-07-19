#!/usr/bin/env bash
# Load Crystalith CL_* for local `just dev` / `just dev-server`.
#
# Non-interactive shells skip most of ~/.bashrc (`[[ $- != *i* ]] && return`),
# so Overmind children would otherwise miss chat/embedding gateway settings.
#
# Precedence (later wins):
#   1) existing process env
#   2) repo-root `.env` (if present)
#   3) `export CL_*` lines from ~/.bashrc
#
# E2E must NOT source this script — Playwright stubs gateways in playwright.config.ts.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

if [[ -f "${HOME}/.bashrc" ]]; then
  eval "$(rg -N '^export CL_' "${HOME}/.bashrc" 2>/dev/null || true)"
fi
