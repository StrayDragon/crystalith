# c61 Tasks

## 1. P1-A: templates builtin 保护

- [ ] 1.1 `templates/router.ts`: PATCH handler 开头查 template，若 `isBuiltin` 为 true 抛 409（"Built-in templates cannot be modified"）
- [ ] 1.2 DELETE handler 同样守卫（"Built-in templates cannot be deleted"）

## 2. P1-B: presets trigger 唯一性 + builtin 冲突

- [ ] 2.1 `prompt-presets/router.ts`: POST handler 检查 trigger 不与已有 custom 重复（DB 查询），重复抛 409
- [ ] 2.2 POST handler 检查 trigger 不与 builtin 冲突（`listPresets()` 的 trigger 集合），冲突抛 409
- [ ] 2.3 PATCH handler 同样检查（排除自身 id），允许不改 trigger 的 PATCH 通过

## 3. 测试

- [ ] 3.1 `test/templates/builtin-protection.test.ts`: PATCH/DELETE builtin 返回 409；非 builtin 正常
- [ ] 3.2 `test/prompt-presets/trigger-uniqueness.test.ts`: 重复 custom trigger 409；与 builtin 冲突 409；PATCH 改自身 trigger 通过

## 4. spec + 验证

- [ ] 4.1 `llman sdd validate c61-fix-v2-templates-presets-builtin-protection` 通过
- [ ] 4.2 `bun test` (server) 通过
- [ ] 4.3 `bun typecheck` (server) ✅
- [ ] 4.4 `bun oxlint` 0 error
