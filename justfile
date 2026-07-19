# Crystalith v2 — Unified Task Runner
# Run `just` or `just -l` to list available tasks.

_default:
    @just -l

# --------------------------------------------------------------------------
# Development
# --------------------------------------------------------------------------

# Install all dependencies (workspace)
install:
    bun install --frozen-lockfile

# Start development environment via Overmind (daemonized/background by default)
# Requires: overmind + tmux.
# - `-D` daemonizes to background (agent-friendly, non-blocking)
# - `-N` keeps app-owned ports (8032 / 3000 / 3030) — prevents Overmind from injecting $PORT
# - `-c slidev` allows preview to exit without tearing down core processes.
#
# Use `just dev-attach` for foreground (interactive tmux) mode.
dev:
    overmind start -D -N -c slidev -f Procfile
    @echo "✅ Overmind daemonized — services running in background"
    @echo ""
    @echo "📋 Available processes: server  web  slidev"
    @echo "   Attach to a process:  overmind connect server"
    @echo "   View aggregated logs: overmind echo"
    @echo "   Check status:         overmind status"
    @echo "   Gracefully stop:      just dev-quit"

# Start development environment in foreground (interactive tmux session)
dev-attach:
    overmind start -N -c slidev -f Procfile

# Start only the Elysia server
# Starts from repo root so config/* paths resolve correctly.
dev-server:
    bun --watch apps/server/src/server.ts

# Start only the frontend
dev-web:
    cd apps/web && bun dev

# Start only Slidev preview (apps/server/slides/preview/slides.md → :3030)
dev-slidev:
    cd packages/crystalith-slidev && bun run dev

# Attach to a running Overmind process (server|web|slidev)
dev-connect process='server':
    overmind connect {{ process }}

# Gracefully stop Overmind (same as Ctrl-C on the start session)
dev-quit:
    overmind quit

# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------

# TODO: Enable when v2 server core is wired up
# build-server:
#     cd apps/server && bun build --compile --outfile=crystalith-server ./src/server.ts

# --------------------------------------------------------------------------
# Code Quality (delegated to root bun scripts)
# --------------------------------------------------------------------------

# Format check (oxfmt) — suppress success noise, only check exit code
format-check:
    @bun format:check > /dev/null

# Format fix (oxfmt --write)
format:
    @bun format:write

# Lint (oxlint) — warnings to stdout, silent on success
lint:
    @bun lint

# Typecheck (all workspaces) — suppress workspace orchestration stdout, preserve tsc errors on stderr
typecheck:
    @bun typecheck > /dev/null

# Run all quality checks (output minimized — only errors/warnings)
check: typecheck lint format-check

# Type-aware linting (oxlint with tsconfig) — advisory; NOT part of `just qa`
# (pre-existing errors, especially in test files). Run manually before large PRs.
type-aware-lint:
    @bun run lint:type-aware

# Lightweight bun-on-PATH check (optional). Formerly `scripts-harness-check`.
# Not part of `just qa` — that recipe was a near no-op under SKIP_READY_INSTALL.
check-bun:
    @command -v bun >/dev/null || (echo "bun not found on PATH" >&2; exit 1)

# Primary PR gate: typecheck, lint, format-check, generated-config drift,
# server+shared unit/integration, frontend Vitest (`test:ci`), Playwright @p0.
# Output minimized — only errors and warnings shown.
#
# Out of gate (run separately when relevant):
#   - `just test-bdd` — server BDD CRUD subset
#   - `just type-aware-lint` — advisory type-aware oxlint
# Requires Chromium once: `just e2e-install` (or system Chrome; see e2e recipe)
qa: check check-env-examples check-app-schema test test-web e2e
    @echo "✅ QA passed"

# Server + shared unit/integration tests — only show failures
test:
    @bun test --only-failures apps/server/test/ packages/shared/test/

# Frontend Vitest CI suite (MSW on-unhandled=error). Part of `just qa`.
test-web:
    cd apps/web && bun run test:ci

# Server BDD (Gherkin) — CRUD subset only; see apps/server/tests/bdd/run.test.ts
# SKIP_FEATURE_DIRS. Not part of `just qa`.
test-bdd:
    @bun test apps/server/tests/bdd/run.test.ts

# Critical browser E2E gate (Playwright @p0). Independent of unit tests.
# Uses isolated ports 13000/18032 + temp DB under e2e/.tmp/
# Default: system Google Chrome. For bundled Chromium: `just e2e-install` then
# `CL_E2E_USE_SYSTEM_CHROME=0 just e2e`
e2e:
    cd e2e && bunx playwright test --grep @p0

# Install Playwright Chromium (one-time / CI bootstrap)
e2e-install:
    cd e2e && bunx playwright install chromium

# Full Playwright suite (currently same as @p0; room to grow non-gate specs)
e2e-all:
    cd e2e && bunx playwright test

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

# Initialize .env and config/secret.env from shell environment variables.
# LEGACY: prefer `cp .env.example .env` + SSOT (`just gen-env-examples`). See script header.
upsert-env-configs:
    @echo "⚠️  upsert-env-configs is legacy; prefer .env.example / secret.env.example (CL_* SSOT)"
    bash ./scripts/init_config.sh

# Regenerate .env.example, config/secret.env.example, and app.schema.gen.json
gen-env-examples:
    bun scripts/gen-env-examples.ts

# Check .example files match Zod SSOT (exit 1 on drift)
check-env-examples:
    bun scripts/gen-env-examples.ts --check

# Regenerate config/app.schema.gen.json from Zod schemas
gen-app-schema:
    bun scripts/gen-app-schema.ts

# Check app.schema.gen.json matches Zod schemas (exit 1 on drift)
check-app-schema:
    bun scripts/gen-app-schema.ts --check

# Regenerate all generated artifacts from SSOT: env examples + JSON schema
gen-all:
    just gen-env-examples gen-app-schema
    @echo "✅ All generated artifacts regenerated from SSOT"

# Check all generated artifacts against SSOT (exit 1 on any drift)
check-generated:
    just check-env-examples check-app-schema
    @echo "✅ All generated artifacts match SSOT"

# --------------------------------------------------------------------------
# Maintenance
# --------------------------------------------------------------------------

# Clean build artifacts
clean:
    rm -rf apps/web/dist
    rm -rf apps/web/node_modules
    rm -rf apps/server/node_modules
