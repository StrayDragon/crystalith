# Execution Guidance

Phase-by-phase patterns for applying the annual cleanup methodology.

## Before Starting

```bash
git checkout main && git pull
git checkout -b cleanup/$(date +%Y)-annual
```

## Phase 0 — Snapshot

Tag the current state for safe rollback:

```bash
git tag pre-cleanup-$(date +%Y%m%d)
```

If a major migration follows, also create a legacy branch:
```bash
git checkout -b legacy-v1
git push origin legacy-v1
git tag v1.0.0
git push origin v1.0.0
git checkout main   # back to clean branch
```

## Phase 1 — Dead Code (Category A)

### How to find dead code
- Search for imports → if nothing imports a module, it's dead
- Check feature flags / config toggles — paths behind permanently-off flags
- Look for "alternative" implementations where only one is ever configured
- Check version‑gated code paths where the lower version is no longer supported

### Safety checklist before deleting
- [ ] `grep -r "module_name" src/` — confirm zero imports
- [ ] `grep -r "ClassName" src/` — confirm zero references
- [ ] Check `pyproject.toml` / `package.json` — remove from workspace members if needed
- [ ] Check migration files — do they reference deleted tables?
- [ ] Run full test suite after removal

### Commit convention
```
refactor: remove dead code — <file1>, <file2>
```

## Phase 2 — Over-Abstraction (Category B)

### How to find over-abstraction
- Factory functions with a `if provider == "X"` / `elif provider == "Y"` chain where only one branch has a live config path
- Auto‑discovery code (`probe()`, `discover()`, `find_endpoints()`) that does HTTP calls at startup
- Interface + multiple implementations where only one is ever instantiated

### Simplification patterns
```python
# Before: multi-backend factory
def create_store(settings):
    if settings.provider == "chroma":
        return ChromaStore(settings)
    elif settings.provider == "memory":
        return MemoryStore(settings)
    elif settings.provider == "redis":
        return RedisStore(settings)

# After: direct construction (runtime config chooses, not the factory)
def create_store(settings):
    return ChromaStore(settings)
```

```python
# Before: auto-discovery with HTTP probes
def discover_models():
    results = []
    for url in configured_urls:
        try:
            resp = http_get(f"{url}/api/tags")
            results.extend(resp.json())
        except:
            pass
    return results

# After: static / no-op
def discover_models():
    return []  # v2 will use static config
```

### Commit convention
```
refactor: simplify <module> — remove multi-backend / probe logic
```

## Phase 3 — Probe Monitoring (Category C)

### How to find probe monitoring
- Background threads / async tasks that poll service health
- Functions named `*monitor*`, `*probe*`, `*health*`, `*watch*`, `*refresh_optional*`
- Startup code that sequentially pings external services
- "Dependency health" endpoints that check multiple backends

### Keep vs Delete
| Keep | Delete |
|------|--------|
| Health endpoint (simplified) | Background polling loops |
| Simple "is DB connected" check | Per‑service recovery hints |
| Config-loading logic | Service‑specific error codes |
| Model/provider metadata | Full status templates with per‑service state |

### Commit convention
```
refactor: remove probe monitoring — <function_list> (~N lines)
```

## Phase 4 — CRUD Bloat (Category D)

### How to find CRUD bloat
- Modules where READ endpoints are heavily used but CREATE/UPDATE/DELETE are never called from UI
- "Admin" endpoints in a user‑facing service
- Resources that are seeded at startup and never modified

### Simplification pattern
- Delete CREATE / UPDATE / DELETE handlers
- Keep READ and any data‑transformation functions
- Remove router registration lines
- Remove cross‑references from the main router file
- In the frontend, remove API client calls and UI components for deleted endpoints

### Cross‑reference checklist
- [ ] Router registration file — remove the deleted router
- [ ] App factory — remove any init calls for the deleted module
- [ ] Other modules — remove imports of the deleted module
- [ ] UI components — remove references to deleted endpoints

### Commit convention
```
refactor: trim <module> CRUD — keep service functions, drop N endpoints
```

## Phase 5 — Unused Deps + Config (Categories E + F)

### How to find unused deps
- `pip freeze` vs actual imports (use `pip-check` or manual audit)
- `package.json` dependencies — search `import` statements across all source
- Workspace members in `pyproject.toml` — check if the package is still used
- Docker build‑time only packages leaking into runtime requirements

### How to find stale config
- Keys that reference removed services
- `_candidates` / `_fallback` / `_discovery` config sections for removed backends
- Migration-era compat keys documented as "temporary"
- Service URLs / host/port for services no longer deployed

### Commit convention
```
refactor: remove unused dep <package> + stale config section <key>
```

## Phase 6 — Devops Artifacts (Category G)

### Cache cleanup
```bash
# Python
find . -type d -name "__pycache__" -not -path '*/.venv/*' -not -path '*/node_modules/*' | xargs rm -rf

# Build output
rm -rf dist/ build/ .ruff_cache/ .mypy_cache/ .pytest_cache/

# Docs
rm -rf site/ .cache/  # if docs are gitignored; rebuild with docs generator
```

### Generated artifact freshness
```bash
# Run generators in check mode (fail if output differs)
./scripts/gen-docs --check
./scripts/gen-schema --check
```

### Docker resource cleanup
```bash
# List orphans
docker container ls -a --filter "name=<project-prefix>" --format '{{.Names}}'
docker volume ls --filter "name=<project-prefix>" --format '{{.Name}}'
docker network ls --filter "name=<project-prefix>" --format '{{.Name}}'

# Remove (after confirming)
docker container rm -f <name>
docker volume rm <name>
```

### Commit convention
```
chore: clean dev caches and stale artifacts
```

## Phase 7 — Full Validation

Run the project's complete quality gate. Typically:
```bash
# Full test suite
just test         # or: make test, pnpm test:ci

# Type checking
pnpm typecheck    # or: mypy ., cargo check

# Lint + format
pnpm lint         # or: ruff check, cargo clippy
pnpm format:check # or: ruff format --check, cargo fmt --check

# Build
pnpm build        # or: cargo build, python -m build

# Generated artifact freshness
just check        # or: make check, npm run check

# Quick smoke test — can the application start?
pnpm dev &        # background
sleep 3
curl -fsS http://localhost:8032/health  # or whatever the health endpoint is
```
