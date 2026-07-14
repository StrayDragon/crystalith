# c61 Design — templates builtin 保护 + presets trigger 唯一性

> SSOT: `backend/py/src/crystalith/features/{templates,prompt_presets}/service.py`

## 决策

### D1: templates is_builtin 保护

PATCH/DELETE handler 开头查 template row，若 `isBuiltin === true`（或 `is_builtin === 1`），抛 409 Conflict（message: "Built-in templates cannot be modified/deleted"）。对齐 v1 service.py:110-111,126-127 的 ValueError（HTTP 400/409）。

选 409 Conflict（而非 403 Forbidden）：v1 抛 ValueError → FastAPI 默认 400，但语义上 409（冲突：builtin 状态冲突）更准确。前端可据 409 显示"内置模板不可修改"。

### D2: presets trigger 唯一性 + builtin 冲突

POST handler：

1. 计算 trigger（normalize: trim + lowercase）
2. 查 DB 是否已有同 trigger 的 custom preset → 若有，409 "Trigger already exists"
3. 查 builtin presets（`listPresets()`）是否含同 trigger → 若有，409 "Trigger conflicts with built-in preset"

PATCH handler：

1. 同上，但排除自身 id（允许不改 trigger 的 PATCH 通过）

对齐 v1 service.py:74-85,101-106。

## 涉及文件

### 修改

- `apps/server/src/features/templates/router.ts` —— PATCH/DELETE 加 is_builtin 守卫
- `apps/server/src/features/prompt-presets/router.ts` —— POST/PATCH 加 trigger 唯一性 + builtin 冲突检查

### 新增测试

- `apps/server/test/templates/builtin-protection.test.ts` —— PATCH/DELETE builtin 返回 409
- `apps/server/test/prompt-presets/trigger-uniqueness.test.ts` —— 重复 trigger 409 + builtin 冲突 409
