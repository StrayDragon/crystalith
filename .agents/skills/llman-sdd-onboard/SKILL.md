---
name: 'llman-sdd-onboard'
description: 'Onboard to the llman SDD workflow in a repository.'
metadata:
  version: '0.0.53'
---

# LLMAN SDD Onboard

Use this skill to onboard to llman SDD in a repository.

## Steps

1. Read `llmanspec/config.yaml` for project context, conventions, and rules.
2. Use `llman sdd list --specs --json` to see all specs at a glance.
   - Or use `llman sdd context --task "<task description>" --paths "<files>"` to find task-relevant specs.
   - If context returns `quality: "unavailable"`, run `llman sdd index rebuild` first (default backend is `pageindex`; it needs `LLMAN_SDD_INDEX_CHAT_MODEL` for retrieval but not for rebuilding).
3. Read only the `direct` spec files from context output.
4. Assess change scale (see triage rules): behavioural contract change → full SDD; implementation change → quick path.
5. Follow proposal -> implement -> archive (full path) or modify directly (quick path).
6. Use `llman sdd graph` to visualize change dependencies.

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

## Notes

- `llmanspec/config.yaml` holds project context, rules, locale, and skills paths.
- Locale affects templates/skills only; CLI stays English.
- Refresh skills with `llman sdd update-skills`.

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

4. BDD empty spec guardrail (`BDD is enabled but this spec declares no requirements and no feature_refs`):
   When `config.yaml` has a `bdd` block, a spec must either declare `requirements`, or point to a `.feature` via `feature_refs` (point-only mode).

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
