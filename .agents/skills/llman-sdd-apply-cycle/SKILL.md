---
name: 'llman-sdd-apply-cycle'
description: 'Single closed-loop for one change: implement→test→validate→archive→commit. Manual trigger only. Agent MUST NOT auto-invoke.'
metadata:
  version: '0.0.61'
disable-model-invocation: true
---

# LLMAN SDD Apply Cycle

Single closed-loop that completes one change end-to-end: implement incomplete tasks, run tests, validate, archive, and commit.

**Manual trigger only**: `/skill:llman-sdd-apply-cycle <change-id>`

## Workflow

### 0) Read status

```bash
llman sdd status <change-id>
```

Parse the TOON output. The `tasks[]` table lists incomplete tasks with test commands. The `next` field gives the immediate next action.

### 1) Loop: implement → test

For each incomplete task from `tasks[]` (in order):

1. Implement the code change
2. Run the test command from `tasks[].test` field (if present)
3. If test fails, fix and retry (up to 3 times)
4. Update `tasks.md` checkbox to `[x]` when done

### 2) Validate

```bash
llman sdd validate <change-id> --strict --no-interactive
```

If validation fails, fix issues and retry (up to 3 times).

### 3) Archive

```bash
llman sdd archive run <change-id>
```

### 4) Commit

```bash
git add -A && git commit -m "<prefix>: <description>"
```

Use conventional commit prefix (feat:/fix:/refactor:).

## Hard Constraints

- **Never ask** "should I continue" — keep executing until done or blocker.
- **Never switch** to another change until current is archived and committed.
- **Retry limit**: 3 attempts per failing step, then report blocker.
- **SSOT**: Use `llman sdd status` output as the single source of truth. Do not read tasks.md/proposal.md/spec files directly.

## Ethics Governance

- `ethics.risk_level`: medium
- `ethics.prohibited_actions`: switching to other changes before current is done, modifying proposal.md/spec files directly, committing without validation
- `ethics.required_evidence`: llman sdd validate --strict pass, llman sdd archive run success, all tasks checked as done in tasks.md
- `ethics.refusal_contract`: if validation fails 3 times, report blocker instead of force-archiving
- `ethics.escalation_policy`: if the change modifies SDD workflow specs or templates, pause and ask user to confirm before archive
