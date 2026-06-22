---
name: "llman-sdd-graph"
description: "Generate a dependency graph from change proposal frontmatter (depends_on/blocks)."
---

# LLMAN SDD Graph

Use this skill to visualize change dependencies as a graph.

## Usage

**Focused view (seed mode):** Show a specific change and its relationship neighborhood.

```bash
llman sdd graph <change-id>              # change + direct relationships (depth 1)
llman sdd graph <change-id> --depth 3    # recurse 3 levels
llman sdd graph <change-id> --depth 0    # just the change itself
```

The seed mode traverses upstream (depends_on), downstream (who depends on it), and blocks edges in all directions. It discovers both active and archived changes automatically.

**Full view (scope mode):** Show all changes by scope.

```bash
llman sdd graph                          # all active changes (default)
llman sdd graph --scope archived         # all archived (done) changes
llman sdd graph --scope all              # everything
```

## Output

- Output goes to stdout as mermaid flowchart. Pipe to a file or renderer:
  ```
  llman sdd graph c50 > deps.mmd
  llman sdd graph c50 --depth 2 | mmdc -i - -o deps.png
  ```
- Archived (done) changes are shown with a "✓ done" suffix and green highlight.
- When the graph has disconnected groups, each group renders as a separate subgraph labeled "Active", "Done", or "Mixed".

## Proposal frontmatter format

```yaml
---
depends_on:
  - other-change-id
blocks:
  - blocked-change-id
---

## Why
...
```

Before acting, read `llmanspec/config.yaml` and follow its `context` and `rules` if present.

Common commands:
- `llman sdd list` (list changes)
- `llman sdd list --specs` (list specs)
- `llman sdd show <id>` (show change/spec)
- `llman sdd validate <id>` (validate a change or spec)
- `llman sdd validate --all` (bulk validate)
- `llman sdd migrate` (one-shot migration of legacy `.md`+fence specs to standalone `.toon`; idempotent)
- `llman sdd archive run <id>` (archive a change)
- `llman sdd archive <id>` (legacy alias of `archive run`)
- `llman sdd archive freeze [--before YYYY-MM-DD] [--keep-recent N] [--dry-run]` (freeze archived dirs into one cold-backup file)
- `llman sdd archive thaw [--change <id> ...] [--dest <path>]` (restore from cold-backup file)
- `llman sdd graph [CHANGE] [--format mermaid] [--scope active|archived|all] [--depth N]` (generate change dependency graph to stdout)


Validation fixes (TOON standalone specs):

1) Missing validation scope (`Spec valid_scope must not be empty`):
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

2) No delta ops in a change: add at least one op + scenario in
`llmanspec/changes/<change-id>/specs/<feature-id>/spec.toon`:
```toon
kind: llman.sdd.delta
ops[1]{op,req_id,title,statement,from,to,name}:
  add_requirement,r1,Title,System MUST do something.,null,null,null
op_scenarios[1]{req_id,id,given,when,then}:
  r1,happy,"",a trigger happens,the outcome is observed
```

3) Tabular value quoting error ("Expected N tabular row values, but got M"):
Values containing **spaces**, commas, colons, or brackets MUST be double-quoted in tabular rows.
```toon
# BAD: spaces in an unquoted value split it into multiple values
r1,happy,"",a trigger happens,the outcome is observed

# GOOD: multi-word values quoted
r1,happy,"","a trigger happens","the outcome is observed"
```

4) BDD empty spec guardrail (`BDD is enabled but this spec declares no requirements and no feature_refs`):
When `config.yaml` has a `bdd` block, a spec must either declare `requirements`, or point to a `.feature` via `feature_refs` (point-only mode).

Notes:
- Each spec is a single standalone `.toon` file; there is no Markdown shell or ```toon fence.
- `null` represents missing optional fields.
- Migrate legacy `.md`+fence specs with `llman sdd migrate`.


## Context
- Gather the current change/spec state before acting.

## Goal
- State the concrete outcome for this command/skill execution.

## Constraints
- Keep changes minimal and scoped.
- Avoid guessing when identifiers or intent are ambiguous.

## Workflow
- Use `llman sdd` commands as the source of truth.
- Validate outcomes when files or specs are updated.

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
