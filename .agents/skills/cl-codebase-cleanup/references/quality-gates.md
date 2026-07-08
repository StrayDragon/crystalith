# Quality Gate Discovery

How to find and run a project's quality gate suite during cleanup.

## Standard Discovery

Look for these indicators (in priority order):

### 1. Root `justfile` / `Makefile`

```bash
# Most projects define a combined quality gate
just check          # fast pre-commit checks
just test           # full test suite
```

### 2. CI configuration

```yaml
# .github/workflows/*.yml — the CI runs the definitive gate
# Look for the test/check commands in CI steps
```

### 3. Pre-commit hooks

```yaml
# .pre-commit-config.yaml — hooks run on every commit
repos:
  - repo: ...
    hooks:
      - id: ...
```

### 4. Language‑specific gate files

| Language   | File                         | Common commands                           |
| ---------- | ---------------------------- | ----------------------------------------- |
| Python     | `pyproject.toml`, `justfile` | `pytest`, `mypy`, `ruff`, `ruff-format`   |
| TypeScript | `package.json`, `justfile`   | `tsc`, `vitest`, `oxlint`, `oxfmt`        |
| Rust       | `Cargo.toml`, `justfile`     | `cargo test`, `cargo clippy`, `cargo fmt` |
| Go         | `go.mod`, `Makefile`         | `go test ./...`, `golangci-lint`          |

### 5. Project README / AGENTS docs

```markdown
# Most projects document the required checks

## Build, Test, and Development Commands

...
```

## Per‑Category Validation

After each phase, run the minimal gate before committing:

| Phase         | Minimal gate                                     |
| ------------- | ------------------------------------------------ |
| 1 (dead code) | Full test suite + typecheck                      |
| 2 (simplify)  | Full test suite + typecheck                      |
| 3 (probes)    | Full test suite                                  |
| 4 (CRUD)      | Test suite + typecheck (both backend + frontend) |
| 5 (deps)      | Install + build + test                           |
| 6 (caches)    | No code change; just verify                      |
| 7 (final)     | Full project quality gate                        |
