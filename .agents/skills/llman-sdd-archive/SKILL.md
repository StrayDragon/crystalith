---
name: 'llman-sdd-archive'
description: 'Archive completed llman SDD changes — merge delta specs into main specs, validate, and guide the final commit. Use after verify reports all-clear. Supports single or batch archiving with full project validation.'
metadata:
  version: '0.0.61'
---

# LLMAN SDD Archive

Use this skill to archive completed changes, merge delta specs into main specs, and guide the commit.

## Pipeline Position

```mermaid
flowchart LR
    verify["llman-sdd-verify<br/>Verify"] --> archive
    archive["★ llman-sdd-archive ★<br/>Archive (you are here)"]
    archive --> commit["git commit<br/>Done"]

    style archive fill:#fff3cd,stroke:#ffc107,stroke-width:3px
```

> 📍 You are in the archive phase: the last stop in the pipeline.
> 📎 If specs get too large, run `llman-sdd-specs-compact` to compress.

## Hard Constraints

- **Must pass verify phase all-green first**: don't archive changes that haven't passed verification.
- **SSOT validation**: every change must pass `llman sdd validate <id> --strict --no-interactive` before archiving.
- **Don't ask "should I continue?"**: execute the full batch to completion unless you hit an unresolvable error.

## Steps

### 0) Preflight

- `git status --porcelain`: confirm working tree changes belong to completed changes.
- If unexpected changes exist, handle them (stash or report).

### 1) Confirm target changes

- Determine target IDs: single or batch (from user input or `llman sdd list --json`).
- Always announce: "Archiving IDs: <id1>, <id2>, ...".
- Confirm each change has passed verify phase all-green.

### 2) Archive one by one

- Validate each first: `llman sdd validate <id> --strict --no-interactive`.
- Validation failure → STOP and report; don't skip validation and force archive.
- Optional preview: `llman sdd archive <id> --dry-run`.
- Execute archive:
  - default: `llman sdd archive run <id>`
  - tooling-only: `llman sdd archive run <id> --skip-specs`
  - **stop immediately on first failure**, report remaining unprocessed IDs.
- **BDD-on**: `archive run` merges the delta `spec.toon` into the main `spec.toon` only. `.feature` files are managed by `llman sdd solidify` — archive does NOT copy `.feature` files. Run `solidify <id>` before archive.

### 3) Full validation

- After all archives complete: `llman sdd validate --all --strict --no-interactive`.
- Confirm post-archive spec artifacts are consistent.

### 4) Commit guidance

- Output suggested commit message (format: `feat(sdd): archive <id1>, <id2> - <short summary>`).
- Prompt user: `git add -A && git commit -m "..."`.
- If user requests auto-commit, execute and output commit hash.

> 💡 Previous phase `llman-sdd-verify` (passed verification) → this phase completes the loop. If specs grow too large, run `llman-sdd-specs-compact`.

## Archive Cold Backup Guidance

- If archived directories are growing too large, use cold backup maintenance:
  - Preview freeze candidates: `llman sdd archive freeze --dry-run`
  - Freeze old archives: `llman sdd archive freeze --before <YYYY-MM-DD> --keep-recent <N>`
  - Restore when needed: `llman sdd archive thaw --change <YYYY-MM-DD-id>`
- Apply freeze/thaw only to dated archive directories (`YYYY-MM-DD-*`) and keep a small recent window unfrozen when possible.

Before acting, read `llmanspec/config.yaml` and follow its `context` and `rules` if present.

Common commands:

- `llman sdd context --task "<description>" --paths "<files>"` (find relevant specs). Uses the pageindex agentic tree backend (needs `LLMAN_SDD_INDEX_CHAT_MODEL`). Preset via `LLMAN_SDD_INDEX_BACKEND`.
- `llman sdd list` (list changes)
- `llman sdd list --specs` (list specs with purpose/scope metadata)
- `llman sdd show <id>` (show change/spec)
- `llman sdd validate <id>` (validate a change or spec)
- `llman sdd validate --all` (bulk validate)
- `llman sdd index rebuild` (rebuild the pageindex tree index — no model needed)
- `llman sdd index check` (check index freshness)
- `llman sdd archive run <id>` (archive a change)
- `llman sdd archive freeze [--before YYYY-MM-DD] [--keep-recent N] [--dry-run]` (freeze archived dirs)
- `llman sdd archive thaw [--change <id> ...] [--dest <path>]` (restore from cold-backup)
- `llman sdd graph [CHANGE] [--format mermaid] [--scope active|archived|all] [--depth N]` (generate change dependency graph)

Validation fixes (TOON standalone specs):

1. Missing validation scope (`Spec valid_scope must not be empty`):
   Main specs MUST carry a non-empty `valid_scope` inside the `.toon` document.
   `llmanspec/specs/<feature-id>/spec.toon`:

```toon
kind: llman.sdd.spec
name: sample
purpose: "One-line overview."
valid_scope[1]: src
requirements[1]{req_id,title,statement}:
  r1,Title,System MUST do something.
scenarios[1]{req_id,id,given,when,then}:
  r1,happy,"",a trigger happens,the outcome is observed
```

2. No delta ops in a change: add at least one op + scenario in
   `llmanspec/changes/<change-id>/specs/<feature-id>/spec.toon`:

```toon
kind: llman.sdd.delta
ops[1]{op,req_id,title,statement,from,to,name}:
  add_requirement,r1,Title,System MUST do something.,null,null,null
op_scenarios[1]{req_id,id,given,when,then}:
  r1,happy,"",a trigger happens,the outcome is observed
```

3. Tabular value quoting error ("Expected N tabular row values, but got M"):
   Values containing **spaces**, commas, colons, or brackets MUST be double-quoted in tabular rows.

```toon
# BAD: spaces in an unquoted value split it into multiple values
r1,happy,"",a trigger happens,the outcome is observed

# GOOD: multi-word values quoted
r1,happy,"","a trigger happens","the outcome is observed"
```

4. BDD spec guardrail (`BDD is enabled but this spec declares no requirements and has no .feature files`):
   When `config.yaml` has a `bdd` block, behavior specs live in `spec.toon` `scenarios` (TOON is the SSOT). `.feature` files are derived by `llman sdd solidify`. A spec with empty `requirements` and empty `scenarios` is an ERROR.

Notes:

- Each spec is a single standalone `.toon` file; there is no Markdown shell or ```toon fence.
- `null` represents missing optional fields.
- Migrate legacy `.md`+fence specs with `llman sdd migrate`.

## Context

- Gather the current change/spec state before acting.
- Prefer `llman sdd context --task --paths` to discover relevant specs instead of guessing or full scans.

## Goal

- State the concrete outcome for this command/skill execution.

## Constraints

- Keep changes minimal and scoped.
- Avoid guessing when identifiers or intent are ambiguous.
- Use `llman sdd context --task --paths` before reading full spec files.
- Choose workflow path based on change scale: behavioral contract changes use full SDD, implementation changes use quick path.

## Workflow

- Use `llman sdd` commands as the source of truth.
- Validate outcomes when files or specs are updated.
- Prefer `llman sdd context` over full reads or guessing.
- When context is unavailable follow error guidance (rebuild index or fall back to `list --specs --json`).

## Decision Policy

- Ask for clarification when a high-impact ambiguity remains.
- Stop instead of forcing through known validation errors.

## Output Contract

- Summarize actions taken.
- Provide resulting paths and validation status.

## Ethics Governance

- `ethics.risk_level`: classify risk as `low|medium|high|critical`.
- `ethics.prohibited_actions`: list actions that MUST NOT be performed.
- `ethics.required_evidence`: list required evidence before high-impact output.
- `ethics.refusal_contract`: define when to refuse and safe alternative response.
- `ethics.escalation_policy`: define when to escalate to user confirmation/review.
