---
depends_on: []
batch: all
---

# c61-fix-v2-templates-presets-builtin-protection — templates builtin 保护 + prompt-presets trigger 唯一性

## Why

2026-07-13 第七轮深度审计发现 templates 与 prompt-presets 域各存在 1 个 P1。这两个域是 v2 新增的 HTTP CRUD（v1 仅有内部 service 无 HTTP 端点），但 v2 的 CRUD 缺 v1 service 层强制的不变量保护。

### 实现违反

1. **P1-A：templates builtin 保护缺失**。v2 `apps/server/src/features/templates/router.ts:89-118` 的 PATCH/DELETE 不守 `is_builtin` 标记，允许修改/删除 builtin 模板。v1 `templates/service.py:110-111,126-127` 的 `update_template`/`delete_template` 抛 `ValueError("Built-in templates cannot be modified/deleted")`。builtin 模板（论文研究/项目文档/知识收集）被改/删后无法恢复。
2. **P1-B：prompt-presets trigger 唯一性/builtin 冲突检查缺失**。v2 `apps/server/src/features/prompt-presets/router.ts:62-101` 的 POST/PATCH 不拒绝 trigger 冲突（与已有 custom 冲突或与 builtin shadow）。v1 `prompt_presets/service.py:74-85,101-106` 的 `create_custom_preset`/`update_custom_preset` 强制：trigger 不得与已有 custom 重复、不得与 builtin 冲突。v2 可创建重复 trigger 或 shadow builtin 的 preset，导致 `/prompt:<trigger>` 解析歧义。

### v1 参考（正确行为）

- `backend/py/.../templates/service.py:110-111,126-127` —— builtin 保护（raise ValueError）。
- `backend/py/.../prompt_presets/service.py:74-85,101-106` —— trigger 唯一性 + builtin 冲突检查。

## What Changes

1. **`apps/server/src/features/templates/router.ts`** —— PATCH/DELETE 前检查 `template.is_builtin`，若为 true 抛 409/403（"Built-in templates cannot be modified/deleted"）。
2. **`apps/server/src/features/prompt-presets/router.ts`** —— POST/PATCH 前：(a) 检查 trigger 不与已有 custom 重复（POST）或不与其他 custom 重复（PATCH 排除自身）；(b) 检查 trigger 不与 builtin preset 冲突（`listPresets()` 的 trigger 集合）。冲突抛 409。
3. **测试** —— builtin template 不可改/删测试 + trigger 重复/builtin 冲突拒绝测试。

## Capabilities

- `chat-prompt-presets` —— ADDED `preset-trigger-must-be-unique-and-not-shadow-builtin`（trigger MUST 唯一 + 不与 builtin 冲突）
- `workspace-api-contract` —— ADDED `builtin-templates-must-not-be-modifiable`（builtin template MUST 不可改/删）

## Impact

- **无 BREAKING**（新增保护性校验，v1 parity）。
- **安全改进**：builtin 模板不可破坏；preset trigger 无歧义。
- **风险**：低。纯增量校验。
- **依赖**：独立于 c57–c60/c62；不阻塞 c13/c14。
