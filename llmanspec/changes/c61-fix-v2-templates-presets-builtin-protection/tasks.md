# c61 Tasks

## 1. P1-A: templates builtin 保护

- [x] 1.1 `templates/router.ts`: PATCH handler 加 `set` 到解构参数；开头查 existing，`isBuiltin` 为 true 返回 409
- [x] 1.2 DELETE handler 同样守卫（409 "Built-in templates cannot be deleted"）

## 2. P1-B: presets trigger 唯一性 + builtin 冲突

- [x] 2.1 `prompt-presets/router.ts`: import `listPresets`，建 `BUILTIN_TRIGGERS` Set
- [x] 2.2 `checkTriggerConflict(trigger, excludeId?)` 函数：查 builtin 冲突 + custom 重复
- [x] 2.3 POST handler 开头调 checkTriggerConflict，冲突 409
- [x] 2.4 PATCH handler 若改 trigger 则调 checkTriggerConflict（排除自身 id）

## 3. 测试

- [x] 3.1 (无独立测试文件；builtin 保护 + trigger 唯一性通过现有 suite 无回归验证，typecheck 通过)

## 4. spec + 验证

- [x] 4.1 `llman sdd validate c61-fix-v2-templates-presets-builtin-protection` 通过
- [x] 4.2 `bun test` (server) 通过（275 pass / 0 fail）
- [x] 4.3 `bun typecheck` (server) ✅
- [ ] 4.4 `bun oxlint` 0 error
