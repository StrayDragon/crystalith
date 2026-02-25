## Why

仓库中存在多种“容易遗忘但很关键”的一致性检查：

- `check-imports`（后端 feature/shared 分层与依赖方向）
- `config-schema`（`config/app.schema.json` 与 `config/app.yaml`/Settings 模型同步）
- OpenAPI / 生成客户端一致性（虽有 CI，但本地忘跑会导致提交后才发现）

当前这些检查分散在不同 `just` 任务/脚本中，开发者需要记忆并手动执行，容易产生漂移与返工。

## What Changes

- 提供统一的本地 guardrails 入口（例如 `just check`）：一次性执行后端导入分层检查、配置 schema 生成/校验、OpenAPI schema check、前端生成客户端一致性检查、类型检查/构建（按需）。
- 将关键一致性检查纳入 pre-commit（或提供可选 hook），在变更触及相关目录时自动执行。
- 在 CI 中补齐缺失的 guardrails（例如 check-imports/config-schema），确保 PR 上能被稳定验证。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `ci-cd`: 扩展 CI/本地检查的最小闭环，覆盖 import 分层与 config schema 一致性等 guardrails。

## Impact

- 受影响代码/配置（预计）：
  - `backend/py/justfile`、根 `justfile`
  - `.pre-commit-config.yaml`
  - `.github/workflows/ci.yml`
  - `config/app.schema.json`（生成/校验路径可能被纳入检查）
- 风险：
  - 本地 hooks/CI 运行时间上升 → 通过路径过滤/拆分 fast checks 与 full checks 缓解
