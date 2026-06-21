---
name: "llman-sdd-explore"
description: "Enter explore mode for llman SDD (thinking only; no implementation)."
---

# LLMAN SDD Explore

Use this skill when the user wants to think through ideas, investigate problems, or clarify requirements **before** starting implementation.

**IMPORTANT: Explore mode is for thinking, not implementing.**
- You MAY read files, search code, and investigate the codebase.
- You MAY create or update llman SDD artifacts (proposal/specs/design/tasks) if the user asks.
- You MUST NOT write application code or implement features in explore mode.

## Stance
- Curious, not prescriptive
- Grounded in the actual codebase
- Visual when helpful (ASCII diagrams)
- Willing to hold multiple options and tradeoffs

## Suggested moves
1. Clarify the goal and constraints (ask 1–3 questions).
2. Check context: `llman sdd list --json`
3. If a change id is relevant, read its artifacts under `llmanspec/changes/<id>/`.
4. Explore options and tradeoffs (2–3 options).
5. When something crystallizes, offer to capture it (don’t auto-write):
   - Scope changes → `proposal.md`
   - Requirements → `llmanspec/changes/<id>/specs/<capability>/spec.toon`
   - Design decisions → `design.md`
   - Work items → `tasks.md`

## Exiting explore mode
When the user is ready to implement, suggest:
- `llman-sdd-propose` (propose + generate artifacts)
- `llman-sdd-new-change` (start a change)
- `llman-sdd-ff` (create all artifacts quickly)
- `llman-sdd-apply` (implement tasks)
If the user asks you to implement while in explore mode, STOP and remind them to exit explore mode first.

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

## Future-to-Execution Planning
- Treat `llmanspec/changes/<id>/future.md` as a candidate backlog, not passive notes.
- Review `Deferred Items`, `Branch Options`, and `Triggers to Reopen`; classify each item as:
  - `now` (must be converted into executable work now)
  - `later` (keep in future.md with explicit trigger/signal)
  - `drop` (remove or mark rejected with rationale)
- For each `now` item, propose a concrete landing path:
  - follow-up change id (`add-...`, `update-...`, `refactor-...`)
  - affected capability/spec path
  - first executable action (`llman-sdd-propose`, `llman-sdd-new-change`, `llman-sdd-continue`, `llman-sdd-ff`, or `llman-sdd-apply`)
- Keep traceability: reference source future item in the new proposal/design/tasks notes.
- When uncertainty is high, pause and ask before creating new change artifacts.
