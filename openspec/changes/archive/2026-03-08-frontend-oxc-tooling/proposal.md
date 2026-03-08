## Why

前端当前使用 `Biome` 做 lint，但 formatter 明确关闭，导致“检查规则”和“统一格式”分离，开发体验不一致；同时 `lint:all` 在当前规则集下会产生大量历史噪声，不利于把 lint 作为日常快速反馈入口。

这次变更把前端工具链统一到 Oxc：使用 `oxlint` 提供更轻量的 JS/TS lint 反馈，使用 `oxfmt` 提供正式的格式化入口，并保持增量 lint + 全量格式化检查的工作流。

## What Changes

- 用 `oxlint` 替代 `frontend/web` 当前的 `Biome lint` 工作流。
- 新增 `oxfmt` 格式化入口：`pnpm run format` 与 `pnpm run format:check`。
- 保留 `pnpm run lint` 作为增量检查入口，并继续以 `origin/main` 为默认比较基线；新增/保留 `lint:all` 作为前端全量检查入口。
- 在 `frontend/web` 进行一次全量格式化收敛，但排除生成产物与第三方/vendor 目录，避免无意义噪声。
- 更新前端开发文档与 OpenSpec 上下文，使仓库约定与实际工具链一致。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `quality-and-regression`: 将前端质量门槛中的 JS/TS lint 与格式化检查入口收敛到 Oxc，并明确增量 lint 与格式化检查的本地工作流。

## Impact

- Frontend tooling:
  - `frontend/web/package.json`
  - `frontend/web/.oxlintrc.json`
  - `frontend/web/.oxfmtrc.json`
  - `frontend/web/scripts/*`（增量 lint helper）
- Frontend source formatting:
  - `frontend/web/src/**`
  - `frontend/web/vite.config.ts`
  - `frontend/web/tsconfig*.json`
- Docs / workflow notes:
  - `frontend/web/AGENTS.md`
  - `docs/content/contributing.md`
  - `openspec/config.yaml`
