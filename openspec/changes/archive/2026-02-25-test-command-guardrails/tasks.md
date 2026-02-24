## 1. 默认测试入口补齐 guardrails

- [x] 1.1 修改 `backend/py/justfile`，让 `just test` 默认覆盖 `check-imports` 与 `config-schema-check`。
- [x] 1.2 修改根目录 `justfile`，让 `just test` 默认覆盖 `just check`（含 API/schema/codegen 一致性检查）。

## 2. 验证

- [x] 2.1 运行 `cd backend/py && just test`，确认 guardrails 与测试可通过。
- [x] 2.2 运行仓库根目录 `just test`，确认默认路径包含 guardrails 且整体通过。

## 验证记录

- `cd backend/py && just test` → 通过（包含 `check-imports`、`config-schema-check`，375 passed，coverage 85.34%）。
- `just test`（repo root）→ 通过（先执行 `just check`，后执行 backend+frontend tests；frontend 83 passed）。
