## Why

当前默认测试入口对 guardrails 覆盖不一致：`backend/py just test` 不会自动执行 import 分层与 config schema 一致性检查，仓库根目录 `just test` 也未默认串联 OpenAPI/前端生成客户端一致性检查。
这导致本地通过测试但在 CI 或 pre-commit 才暴露漂移问题，增加返工成本。

## What Changes

- 调整 `backend/py/justfile`：将 `check-imports` 与 `config-schema-check` 纳入 `just test` 默认路径。
- 调整根目录 `justfile`：将 `just check`（含 OpenAPI + generated client 一致性）纳入 `just test` 默认路径。
- 更新对应 OpenSpec 规范，明确“默认测试入口必须包含 guardrails”。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `ci-cd`: 扩展默认测试入口约束，确保本地与 CI 的关键 guardrails 不分离。

## Impact

- 受影响文件：
  - `backend/py/justfile`
  - `justfile`
- 对运行时 API/业务逻辑无影响，仅调整工程质量检查默认行为。
