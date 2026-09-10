## Summary / 概述

Describe what changed and why.

## Linked issues / 关联 Issue

- Issue:

## Changes / 变更内容

-

## Testing / 测试

- [ ] `just qa`（主门禁：typecheck + lint + format + schema + **server/shared unit** + **web Vitest** + **e2e @p0**）
- [ ] 相关时另跑：`just test-bdd` / `just type-aware-lint`
- [ ] `bun typecheck`（跨包时）

Results:

## Screenshots / GIFs (UI changes)

## Checklist / 自检清单

- [ ] No secrets or tokens committed
- [ ] Docs updated (if needed) — see `AGENTS.md`
- [ ] Critical-path UI copy is centralized via `t()` (avoid new hardcoded strings) / 关键路径文案集中管理（避免新增硬编码）
- [ ] New critical UI controls use `data-testid` from `apps/web/src/shared/testids.ts` (E2E must not rely on Chinese copy)
