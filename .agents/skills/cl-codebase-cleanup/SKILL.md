---
name: cl-codebase-cleanup
description: >
  A reusable methodology for annual codebase cleanup. Defines 7 categories of
  cleanup (dead code, over-abstraction, probe monitoring, CRUD bloat, unused
  deps, devops artifacts, caches) and a 7-phase process with quality gates.
  Use when planning or executing a systematic cleanup — especially before a
  major migration or tech-stack rewrite. The agent will inspect the project to
  map categories to actual files. Not auto-activated; invoke explicitly via
  /cl-codebase-cleanup.
---

# Annual Code Cleanup — Methodology

A reusable framework for systematic codebase cleanup. Designed to be adapted to any project, not tied to specific file paths.

## Principles

| #   | Principle                    | Why                                                            |
| --- | ---------------------------- | -------------------------------------------------------------- |
| 1   | **Business logic untouched** | Only clean infrastructure / glue / dead weight                 |
| 2   | **Ship incrementally**       | Each cleanup category = one commit, each passing quality gates |
| 3   | **No behavioral change**     | Cleanup must never alter user-visible behavior                 |
| 4   | **Verify after every phase** | Run tests / typecheck / lint after each commit                 |

## The 7 Cleanup Categories

Use these categories to classify everything the agent finds during project inspection:

| Cat   | Category                                                          | What to look for                                                                                  |
| ----- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **A** | **Dead code** — files never executed                              | Unreachable modules, feature flags always off, replaced implementations                           |
| **B** | **Over-abstraction** — glue code with too many branches           | Multi-backend factories, auto-discovery probes, provider selection layers with a single live path |
| **C** | **Probe monitoring** — runtime health polling                     | Optional-service watchers, endpoint liveness probes in business code, auto-registration loops     |
| **D** | **CRUD bloat** — unnecessary API surface                          | Full CRUD on read-mostly resources; delete endpoints, keep service functions                      |
| **E** | **Unused dependencies** — declared but never imported             | npm / pip packages, workspace members, build-time only deps leaking into runtime                  |
| **F** | **Configuration dead weight** — config keys with no effect        | Stale sections, migration-era compat keys, service URLs for removed backends                      |
| **G** | **Devops artifacts** — stale caches, build output, dangling infra | `__pycache__`, build dirs, orphan Docker resources, out-of-sync docs                              |

## The 7-Phase Process

```
Phase 0  — Snapshot: tag current state as a fallback point
Phase 1  — Category A: remove dead-code files
Phase 2  — Category B: simplify over-abstracted glue
Phase 3  — Category C: delete probe monitoring
Phase 4  — Category D: trim CRUD bloat, fix cross-references
Phase 5  — Category E+F: purge unused deps + stale config
Phase 6  — Category G: clean devops artifacts + docs refresh
Phase 7  — Validate: full quality gate suite
```

### Phase 0 — Snapshot

Tag the current branch before any destructive change:

```bash
git tag pre-cleanup-$(date +%Y%m%d)
```

This gives a clean rollback point.

### Phases 1–6 — Execute

For each category, the agent:

1. **Inspect** the project to map the category to actual files / config
2. **Verify** no active references exist (grep for imports, tooling configs)
3. **Remove or simplify** the identified targets
4. **Run quality gates** (test suite, typecheck, lint)
5. **Commit** with a category-prefixed message

### Phase 7 — Validate

Run the project's full quality gate suite:

- Tests
- Type checking
- Linting + formatting
- Build smoke test
- Generated artifact freshness check (docs, schemas)

## Common Risk Responses

| Pattern                                       | Mitigation                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| Deleting a file that something else imports   | `grep -r` before deleting, run tests after                              |
| Migration files referencing deleted tables    | Mark migration as superseded, never delete historical migrations        |
| Config keys referenced in deployment overlays | Check `deployments/`, `docker-compose*.yml`, CI configs before deleting |
| Generated artifacts go stale                  | Run generator + drift-check as part of Phase 6                          |
| Third‑party submodule changes                 | Remove source references only, keep submodule pointer intact            |

## Adapting to a Project

When invoked, the agent should:

1. **Read the project's AGENTS/CONTRIBUTING docs** to learn the tech stack, conventions, and quality gates
2. **Map the 7 categories** to the actual filesystem — what's the dead code? What's the over-abstraction?
3. **Identify the quality gate commands** (typically `just check`, `make test`, `pnpm typecheck`, etc.)
4. **Propose a concrete Phase 1–6 plan** with file paths before executing anything

The skill is abstract; the agent fills in the specifics at runtime.

## Progressive Reference Files

When the task requires deeper detail, read:

- [execution-guidance](references/execution-guidance.md) — phase-by-phase patterns, grep strategies, commit message conventions
- [quality-gates](references/quality-gates.md) — how to discover and run a project's quality gate suite
- [example-execution](references/example-execution.md) — worked example of the methodology applied to one project (Crystalith)
