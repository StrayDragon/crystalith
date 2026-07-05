# Example: Crystalith Annual Cleanup

This is a worked example of the methodology applied to one specific project. Use it as a template for adapting to other projects. **Do not treat the paths here as authoritative — always inspect the actual project at runtime.**

## Project Baseline (at time of writing)

| Dimension | Value |
|-----------|-------|
| Backend stack | Python 3.12+ / FastAPI / async SQLAlchemy |
| Frontend stack | Vite + React + TypeScript |
| Total backend lines | ~32,000 |
| Total frontend lines | ~49,000 |
| API endpoints | ~94 |
| Feature modules | ~21 |
| Workspace packages | ~8 |
| Quality gate | `just check` (root), `just test` (backend), `pnpm test:ci` (frontend) |
| Dep mgmt | `uv sync` (Python), `pnpm install` (frontend) |

## Category Mapping

| Cat | What was found | How many |
|-----|---------------|----------|
| A | Modules behind always-off config paths, replaced implementations, unused provider | ~9 files / ~1,200 lines |
| B | Multi-backend factories with a single live path, auto-discovery with HTTP probes | ~4 modules / ~540 lines |
| C | Background polling of optional services in app factory | ~350 lines |
| D | Full CRUD on read-mostly resources (prompt presets, templates) | ~350 lines |
| E | npm packages imported by nothing (`@tambo-ai/react`, `@ag-ui/core`) | 2 packages |
| F | Config keys for removed backends (chroma host, redis candidates) | ~5 sections |
| G | `__pycache__` dirs, `dist/`, ruff cache, stale docs cache | ~114 dirs + misc |

## Quality Gates Used

```bash
# After each Phase 1–5 commit
cd backend/py && just check
cd frontend/web && pnpm typecheck

# After Phase 6
just gen-docs && just docs-drift-check && just doc-governance-check

# Phase 7 — full gate
cd backend/py && just test && just typecheck && just check
cd frontend/web && pnpm install && pnpm typecheck && pnpm test:ci
cd /repo/root && just check
```

## Branching After Cleanup

```bash
# Save Python version as v1
git checkout main
git checkout -b v1
git push origin v1
git tag v1.0.0

# Create v2 branch from cleaned main
git checkout main
git checkout -b v2
```
