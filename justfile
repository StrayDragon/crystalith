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

# Type-aware linting (oxlint with tsconfig) — warnings to stdout, silent on success
type-aware-lint:
    @bun run lint:type-aware

# Run scripts/ harness checks (bun availability only, skip install)
scripts-harness-check:
    @CRYSTALITH_SKIP_READY_INSTALL=1 bash ./scripts/ensure_frontend_web_ready.sh

# Run all QA checks (SSOT): typecheck, lint, format-check, generated-config drift, tests, and scripts/ harness checks.
# Output minimized — only errors and warnings shown.
# Note: `just type-aware-lint` is excluded — too many pre-existing errors in test files.
qa: check check-env-examples check-app-schema test scripts-harness-check
    @echo "✅ QA passed"

# Run backend tests — only show failures
test:
    @bun test --only-failures apps/server/test/ packages/shared/test/

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

# Initialize .env and config/secret.env from shell environment variables
upsert-env-configs:
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
