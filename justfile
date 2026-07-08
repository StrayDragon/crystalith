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

# Start development environment (server + frontend hot reload in parallel)
dev:
    bun dev

# Start only the Elysia server
dev-server:
    cd server && bun dev

# Start only the frontend
dev-web:
    cd frontend/web && bun dev

# Start both (two terminals: `just dev-server` + `just dev-web`)
# Or use: bun run dev:server & bun run dev:web

# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------

# Build frontend for production
build-web:
    cd frontend/web && bun run build

# Build server binary (bun build --compile)
# TODO: Enable when v2 server scaffold is ready
# build-server:
#     cd server && bun build --compile --outfile=crystalith-server ./src/server.ts

# Full production build
# build: build-web build-server

# --------------------------------------------------------------------------
# Testing
# --------------------------------------------------------------------------

# Run all tests (frontend only for now)
test:
    cd frontend/web && bun run test:ci

# Run frontend CI tests
test-frontend:
    cd frontend/web && bun run test:ci

# --------------------------------------------------------------------------
# Code Quality
# --------------------------------------------------------------------------

# Type check frontend
typecheck:
    cd frontend/web && bun run typecheck

# Lint frontend (incremental)
lint:
    cd frontend/web && bun run lint

# Format check frontend
format-check:
    cd frontend/web && bun run format:check

# Format frontend
format:
    cd frontend/web && bun run format

# Run all quality checks
check: typecheck lint format-check
    @echo "All checks passed."

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
    rm -rf frontend/web/dist
    rm -rf frontend/web/node_modules
    # TODO: add server/node_modules, server/dist when scaffolded
