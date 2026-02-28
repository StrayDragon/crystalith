## Why

- 当前部署形态以“从源码构建 compose 镜像”为主路径，CI 也缺少将 `api/web` 镜像发布到 registry 的闭环。对于自托管与对外发布而言，提供版本化、可直接 `docker pull` 的 GHCR 镜像能显著降低用户成本，并让发布/回滚具备可追溯性（tag → 镜像 → 运行验收）。

## What Changes

- 新增 GHCR 发布链路（GitHub Actions）：
  - 在 tag（`vX.Y.Z`）触发时构建并推送 `api` 与 `web` 两个镜像；
  - 采用稳定的 tagging 策略（`X.Y.Z`/`X.Y`/`X`/`latest`/`sha-<shortsha>` 等）并写入 OCI labels；
  - 支持多架构（`linux/amd64` + `linux/arm64`）构建（如可行）。
- 增加最小发布后验收：
  - 从刚推送的镜像拉起最小拓扑并验证 `/health`、Nginx 反代与基础路由可用。
- （可选）提供基于 `image:` 的 compose 使用路径（与现有 build-from-source 并存），并在部署文档中说明如何选择。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `delivery-and-deployment`: 交付必须包含可发布镜像与可追溯的 registry 分发策略（构建、标签、验收与回滚）。

## Impact

- CI: 需要新增发布工作流并启用 `packages: write` 权限；需要在 repo 设置中允许 GitHub Actions 推送到 GHCR。
- Deployments/Docs: 可能需要补充“从 GHCR 拉取镜像”的使用说明与验收步骤。
- Repo: 可能新增一个“镜像发布版本一致性检查”（tag vs 版本源文件）以避免发布漂移。
