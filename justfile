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
# - Loads CL_* via scripts/load-cl-env.sh (.env + ~/.bashrc exports) for live gateways.
# - E2E uses separate ports/DB and stubs gateways — does not source this loader.
#
# Use `just dev-attach` for foreground (interactive tmux) mode.
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    # shellcheck disable=SC1091
    source ./scripts/load-cl-env.sh
    overmind start -D -N -c slidev -f Procfile
    echo "✅ Overmind daemonized — services running in background"
    echo ""
    echo "📋 Available processes: server  web  slidev"
    echo "   Attach to a process:  just dev-connect <some-app> | just dev-attach"
    echo "   Gracefully stop:      just dev-quit"

# Start development environment in foreground (interactive tmux session)
dev-attach:
    #!/usr/bin/env bash
    set -euo pipefail
    # shellcheck disable=SC1091
    source ./scripts/load-cl-env.sh
    overmind start -N -c slidev -f Procfile

# Start only the Elysia server
# Starts from repo root so config/* paths resolve correctly.
dev-server:
    #!/usr/bin/env bash
    set -euo pipefail
    # shellcheck disable=SC1091
    source ./scripts/load-cl-env.sh
    bun --watch apps/server/src/server.ts

# Start only the frontend
dev-web:
    cd apps/web && bun dev

# Start only Slidev preview (data/slides/preview/slides.md → :3030)
dev-slidev:
    cd packages/crystalith-slidev && bun run dev

# Attach to a running Overmind process (server|web|slidev)
dev-connect process='server':
    overmind connect {{ process }}

# Gracefully stop Overmind (same as Ctrl-C on the start session)
dev-quit:
    overmind quit
    sleep 3

alias dev-stop := dev-quit

# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------

# Compile the server single binary (API + static web host) with version
# injection + bundling workarounds (see apps/server/scripts/build-binary.ts)
build-binary:
    cd apps/server && bun scripts/build-binary.ts

# Assemble the c13 v1 release archive for the current platform into
# target/release/ (binary + web/dist + drizzle; see scripts/build-release.ts)
release:
    bun scripts/build-release.ts

# Compute and create the next v<base>-pre.N tag at HEAD (never moves tags).
# Creating is local-only; pushing the tag triggers the Release workflow.
#   just release-next-pre            # auto-detect base from the latest v*-pre* tag
#   just release-next-pre 2.0.0      # explicit base
#   just release-next-pre --dry-run  # print the tag without creating it
release-next-pre *args:
    bun scripts/release-next-pre-tag.ts {{args}}

# --------------------------------------------------------------------------
# Code Quality (delegated to root bun scripts)
# --------------------------------------------------------------------------

# --- QA 输出详细程度 (三档; 机制对标 ../scalim/scripts/qa-step.sh) ---
#   L0 静默 (默认, 适合 agent): 各步只启用工具自带的安静开关
#        (--quiet / --only-failures / dot reporter / CL_LOG_LEVEL),
#        通过时仅输出错误与警告级汇总; 失败时工具照常全量输出.
#   L1 摘要 (QA_VERBOSE=1): 同 L0 (工具内置最小输出即一行摘要形式).
#   L2 全量 (QA_VERBOSE=2): 关闭全部安静开关, 实时流式全量输出 (排障).
# 用法: just qa          # L0 (agent / CI)
#       just QA_VERBOSE=1 qa
#       just QA_VERBOSE=2 qa     # 排障时用
#
# 原则: 只用工具/应用自带的安静能力, 不做自定义 stdout 过滤脚本.
QA_VERBOSE := ""

# 各 gate 步 quiet 旗标 (L2 = "" 关闭所有静默)
_qlint   := if QA_VERBOSE == "2" { "" } else { "--quiet" }
_qtest   := if QA_VERBOSE == "2" { "" } else { "--only-failures" }
_qrstest := if QA_VERBOSE == "2" { "" } else { "--reporter=dot --silent passed-only --hideSkippedTestFiles" }
_qe2e    := if QA_VERBOSE == "2" { "" } else { "--reporter=dot --quiet" }
_qlog    := if QA_VERBOSE == "2" { "info" } else { "error" }
_qtmock  := if QA_VERBOSE == "2" { "" } else { "> /dev/null" }

# Format check (oxfmt) — suppress success noise, only check exit code
format-check:
    @bun format:check > /dev/null

# Format fix (oxfmt --write)
format:
    @bun format:write

# Lint (oxlint) — L0: 只列错误 + 警告计数 (--quiet); L2: 全部警告详情
lint:
    @bun lint {{ _qlint }}

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
# server+shared unit/integration, frontend Rstest (`test:ci`), Playwright @p0.
# Output minimized — only errors and warnings shown.
#
# Out of gate (run separately when relevant):
#   - `just test-bdd` — server BDD CRUD subset
#   - `just type-aware-lint` — advisory type-aware oxlint
# Requires Chromium once: `just e2e-install` (or system Chrome; see e2e recipe)
qa: check check-env-examples check-app-schema check-i18n-keys check-provider-deps test test-web e2e
    @echo "✅ QA passed"

# Server + shared unit/integration tests — L0: 仅错误级应用日志 + 失败
# (--only-failures; CL_LOG_LEVEL=error); L2: info 全量。
# BDD (apps/server/tests/bdd) 经 --path-ignore-patterns 排除在门禁外：
# 它是补充性的 CRUD 子集，单独跑 `just test-bdd`（见下与根 AGENTS.md）。
test:
    @CL_LOG_LEVEL={{ _qlog }} bun test {{ _qtest }} --path-ignore-patterns='apps/server/tests/bdd/**' apps/server/tests/ packages/shared/test/

# Frontend Rstest CI suite (MSW on-unhandled=error). Part of `just qa`.
# L0: mock 报告静默 + dot reporter + passed-only 静默 (仅失败显示 console)
test-web:
    @cd apps/web && node ./scripts/test_mock_report.mjs --check-mock-reasons {{ _qtmock }} && TZ=UTC RSTEST_MSW_ON_UNHANDLED=error bunx rstest run {{ _qrstest }}

# Server BDD (Gherkin) — CRUD subset only; see apps/server/tests/bdd/run.test.ts
# SKIP_FEATURE_DIRS. Not part of `just qa`.
test-bdd:
    @bun test apps/server/tests/bdd/run.test.ts

# Critical browser E2E gate (Playwright @p0). Independent of unit tests.
# Uses isolated ports 13000/18032 + temp DB under e2e/.tmp/
# Stubs chat/embedding gateways offline (does not use live CL_* from justdev).
# Default: system Google Chrome. For bundled Chromium: `just e2e-install` then
# `CL_E2E_USE_SYSTEM_CHROME=0 just e2e`
# L0: dot reporter + --quiet (静默 test/webserver stdio, 仅保留结果行)
e2e:
    @cd e2e && bunx playwright test {{ _qe2e }} --grep @p0

# Optional @p1 browser flows (not in `just qa`)
e2e-p1:
    cd e2e && bunx playwright test --grep @p1

# Install Playwright Chromium (one-time / CI bootstrap)
e2e-install:
    cd e2e && bunx playwright install chromium

# Full Playwright suite (@p0 + @p1)
e2e-all:
    cd e2e && bunx playwright test --grep '@p0|@p1'

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

# Regenerate favicon / PWA icons from assets/logo.webp
gen-brand-icons:
    bash scripts/gen-brand-icons.sh

# Regenerate .env.example and app.schema.gen.json
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

# Check every desc('key') in shared schemas exists in zh/index.json
check-i18n-keys:
    bun scripts/check-i18n-keys.ts

# Check provider registry sdk packages are declared in apps/server deps
check-provider-deps:
    bun scripts/check-provider-deps.ts

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
