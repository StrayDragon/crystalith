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

# Start development environment via Overmind (Procfile: server + web + slidev)
# Requires: overmind + tmux. `-N` keeps app-owned ports (8032 / 3000 / 3030).
# `-c slidev` allows preview to exit without tearing down core processes.
dev:
    overmind start -N -c slidev -f Procfile

# Start only the Elysia server
dev-server:
    cd apps/server && bun dev

# Start only the frontend
dev-web:
    cd apps/web && bun dev

# Start only Slidev preview (apps/server/slides/preview/slides.md → :3030)
dev-slidev:
    cd packages/crystalith-slidev && bun run dev

# Attach to a running Overmind process (server|web|slidev)
dev-connect process='server':
    overmind connect {{process}}

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

# Format check (oxfmt)
format-check:
    bun format:check

# Format fix (oxfmt --write)
format:
    bun format:write

# Lint (oxlint)
lint:
    bun lint

# Typecheck (all workspaces)
typecheck:
    bun typecheck

# Run all quality checks
check: typecheck lint format-check
    @echo "All checks passed."

# Run backend tests
test:
    bun test apps/server/test/ packages/shared/test/

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

# Initialize .env and config/secret.env from shell environment variables
upsert-env-configs:
    bash ./scripts/init_config.sh

# --------------------------------------------------------------------------
# Maintenance
# --------------------------------------------------------------------------

# Clean build artifacts
clean:
    rm -rf apps/web/dist
    rm -rf apps/web/node_modules
    rm -rf apps/server/node_modules
