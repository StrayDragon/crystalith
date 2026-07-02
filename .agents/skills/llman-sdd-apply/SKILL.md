---
name: "llman-sdd-apply"
description: "Implement tasks from an llman SDD change and update tasks.md checkboxes."
metadata:
  version: "0.0.53"
---

# LLMAN SDD Apply

Implement a change by completing `llmanspec/changes/<id>/tasks.md` from top to bottom.

## Steps
1. Use `llman sdd context --task "<goal from proposal>" --paths "<scope from specs>"` to confirm relevant specs.
   - If context is unavailable, rebuild with `llman sdd index rebuild` (default `pageindex` tree index, no model needed) and retry; for the `rag` backend add `--backend rag`.
2. Select the change id:
   - If provided, use it.
   - Otherwise infer from context; if ambiguous, run `llman sdd list --json` and ask the user to choose.
   - Always announce: "Using change: <id>" and how to override.
2. Check prerequisites (authoritative stage gate):
   - Read the change's stage from the authoritative source:
     ```bash
     stage=$(llman sdd show <id> --json --type change | jq -r .stage)
     ```
     (If `jq` is unavailable, parse the `stage` value from the JSON with any tool.)
   - If `stage` is `draft`, the change is not ready to implement → STOP with a guard:
     `draft`: "Change <id> is a draft proposal (proposal.md only). It is not ready to implement. Grow it to at least `spec` stage first with: llman-sdd-continue <id> (proposal → specs → tasks)."
   - `specified`, `designed`, and `full` stages are all ready to implement (tasks.md exists), proceed.
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
