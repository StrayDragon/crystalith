## Why

当前仓库缺少针对 PR 的自动化质量门禁（后端/前端单测、构建、契约一致性校验），并且发布流程偏“人肉步骤化”；在 public 发布后，这会显著增加回归风险、降低协作效率，也不利于持续交付（尤其是 SDK 发布）。

## What Changes

- 新增一条主 CI workflow（push + pull_request）：
  - 后端：依赖安装（uv）→ 单测（pytest）→（可选）静态检查（如 ruff/mypy，若纳入则在 design/tasks 明确引入）。
  - 前端：依赖安装（pnpm）→ 单测（vitest）→ 构建（vite build）→（可选）类型检查（tsc）。
  - API 一致性：校验 `frontend/web/openapi.json` 与后端导出的 schema 一致；校验生成的前端 API client（`pnpm run api:generate` 后无 diff）。
- 统一 CI 触发与缓存策略（pnpm store / uv cache），减少重复构建时间。
- Python SDK freshness check（不含发布逻辑）：在 CI 中执行生成/校验无 diff，防止仓库内 SDK 漂移。

## Capabilities

### New Capabilities

- `ci-cd`: 提供覆盖后端/前端测试与构建、以及 API 合同一致性校验的 PR 检查流水线；并提供可审计的 SDK freshness check 入口。

### Modified Capabilities

- `python-sdk`: 明确 SDK freshness check 的自动化入口与约束（确保生成产物与 schema 同步）。

## Impact

- GitHub Actions：新增 `.github/workflows/ci.yml`（或同等命名），可能调整现有 SDK workflows 以复用步骤/对齐约束。
- Repo 工具链：可能需要补充/固化用于 CI 的命令入口（例如统一使用 `just test`、`just api-check`、或新增 `just type-check` 等）。
- 文档：更新 `docs/` 或 `README.md` 说明 CI 约束与 SDK freshness check（不包含发包/发布自动化）。
- 非目标：不在此变更中提升业务功能覆盖率本身（测试补齐属于独立工作项，可在 tasks 中拆分并并行推进）。
