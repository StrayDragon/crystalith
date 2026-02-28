## Summary / 概述

Describe what changed and why.

## Linked issues / specs / 关联 Issue / Spec

- Issue:
- OpenSpec change (if any):

## Changes / 变更内容

-

## Testing / 测试

- [ ] `cd backend/py && just test`
- [ ] `cd frontend/web && pnpm test`
- [ ] `cd frontend/web && pnpm run typecheck`
- [ ] `just docs-build` (if docs changed)

Results:

## Screenshots / GIFs (UI changes)

## Checklist / 自检清单

- [ ] No secrets or tokens committed
- [ ] Docs updated (if needed)
- [ ] OpenAPI client regenerated if API changed (`pnpm -C frontend/web run api:sync`)
- [ ] Critical-path UI copy is centralized via `t()` (avoid new hardcoded strings) / 关键路径文案集中管理（避免新增硬编码）
