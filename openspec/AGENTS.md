# OpenSpec Notes

This folder contains the spec system used in this repo.

## Layout
- `openspec/specs/<capability>/spec.md` is the canonical spec for a capability.
- `openspec/changes/<YYYY-MM-DD>-<slug>/` is the workspace for an in-progress change.
- `openspec/changes/archive/<...>/` contains completed/archived changes.
- `openspec/notplan-changes/` contains legacy/unstructured proposals; avoid adding new work here unless explicitly requested.

## Change Artifacts (typical)
- `.openspec.yaml` (metadata like `schema` + `created`)
- `proposal.md` (Why / What / Capabilities / Impact / Verification)
- `tasks.md` (checklist + explicit manual verification items + test commands/results)
- `design.md` (optional)
- `specs/<capability>/spec.md` (delta specs for the change)

## Workflow (high level)
1. Create/iterate the change under `openspec/changes/…` and keep `tasks.md` up to date.
2. Update delta specs under the change’s `specs/` as you implement.
3. When done, sync the delta specs into `openspec/specs/` (or update canonical specs directly).
4. Archive the change folder to `openspec/changes/archive/`.

## Keeping context fresh
If repo commands/layout/conventions change, update both `AGENTS.md` (repo root) and `openspec/config.yaml` so future changes/proposals don’t drift.
