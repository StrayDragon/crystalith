---
name: "llman-sdd-apply"
description: "Implement tasks from an llman SDD change and update tasks.md checkboxes."
---

# LLMAN SDD Apply

Implement a change by completing `llmanspec/changes/<id>/tasks.md` from top to bottom.

## Steps
1. Select the change id:
   - If provided, use it.
   - Otherwise infer from context; if ambiguous, run `llman sdd list --json` and ask the user to choose.
   - Always announce: "Using change: <id>" and how to override.
2. Check prerequisites (authoritative stage gate):
   - Read the change's stage from the authoritative source:
     ```bash
     stage=$(llman sdd show <id> --json --type change | jq -r .stage)
     ```
     (If `jq` is unavailable, parse the `stage` value from the JSON with any tool.)
   - If `stage` is not `full`, the change is not ready to implement → STOP with a guard:
     - `draft`: "Change <id> is a draft proposal (proposal.md only). It is not ready to implement. Grow it to full first with: llman-sdd-continue <id> (proposal → specs → design → tasks)."
     - other non-full (`specified`/`designed`): "Change <id> is in <stage> stage, not ready to implement. Grow it to full first with: llman-sdd-continue <id>."
   - `full` stage implies `tasks.md` exists; proceed.
3. Read context files (as applicable):
   - `llmanspec/changes/<id>/proposal.md`
   - `llmanspec/changes/<id>/design.md` (if present)
   - `llmanspec/changes/<id>/tasks.md`
   - `llmanspec/changes/<id>/specs/**`
4. Show status:
   - Progress: "N/M tasks complete"
   - The next 1–3 unchecked tasks (brief)
5. Implement tasks in order:
   - Keep changes minimal and scoped to the current task
   - After completing a task, immediately update its checkbox (`- [ ]` → `- [x]`)
   - If a task is unclear, you hit a blocker, or specs/design don't match reality, STOP and ask what to do next.

7. When tasks are complete (or when pausing), run validation:
   ```bash
   llman sdd validate <id> --strict --no-interactive
   ```
   - If clean, suggest running `llman-sdd-verify`, then archive with `llman sdd archive run <id>`.

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
