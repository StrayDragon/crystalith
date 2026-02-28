## Context

- 仓库已有生产 Dockerfile：
  - `dockers/backend/Dockerfile`（FastAPI `api`）
  - `dockers/frontend/Dockerfile` + `dockers/nginx/default.conf`（Nginx `web`，反代到 `api`）
- 现有 `deployments/prod/docker-compose.yml` 以 `build:` 为主路径，CI 也只做 compose smoke，并没有 registry 发布闭环。
- 对外发布/自托管用户更希望直接拉取镜像（无需 clone + build），且需要稳定的 tag 与可追溯信息（版本、commit SHA、构建时间）。

## Goals / Non-Goals

**Goals:**

- 构建并发布两个镜像到 GHCR：`api` 与 `web`。
- 以 tag 驱动发布：`vX.Y.Z` → 推送带 SemVer 标签的镜像，并附带 `sha-<shortsha>`。
- 支持多架构（优先 `linux/amd64` + `linux/arm64`），并使用 GHA cache 加速。
- 发布后做最小运行验证：从 GHCR 拉取镜像并验证 `/health` 以及 `web`→`api` 反代链路。

**Non-Goals:**

- 不替换/删除 build-from-source 的 compose 主路径（两者可以并存）。
- 不引入 Helm/K8s 等新编排方式（仅 GHCR 镜像交付）。
- 不改变运行端口/路由语义（仅交付方式变化）。

## Decisions

1. **新增独立的发布工作流**
   - 新建 `.github/workflows/publish-images.yml`（或等价命名），避免污染现有 CI。
   - workflow `permissions` 最小化：`contents: read` + `packages: write`（推送 GHCR 必需）。

2. **镜像命名与标签策略**
   - 镜像名建议：
     - `ghcr.io/<owner>/crystalith-api`
     - `ghcr.io/<owner>/crystalith-web`
   - tag `vX.Y.Z` 触发时：
     - 发布：`X.Y.Z`、`X.Y`、`X`、`latest`（或 `stable`）以及 `sha-<shortsha>`。
   - `main`（可选）触发时：
     - 发布：`edge` 与 `sha-<shortsha>`（不覆盖 `latest`）。
   - 使用 `docker/metadata-action` 写入 OCI labels（source、revision、version）。

3. **构建与推送实现**
   - 使用 `docker/setup-buildx-action`（必要时加 `setup-qemu-action`）进行多架构构建。
   - 使用 `docker/login-action` 登录 GHCR（`GITHUB_TOKEN`）。
   - 对 `api` 与 `web` 分别执行 build+push，启用 `cache-to/from: type=gha`。

4. **版本一致性守护**
   - 发布前校验：tag 版本与仓库版本源一致（例如后端 `backend/py/pyproject.toml`、前端 `frontend/web/package.json`）。
   - 不一致则 fail-fast，避免发布“版本号与镜像标签不一致”的产物。

5. **发布后最小验收**
   - 从 GHCR 拉取刚发布的 `api` 与 `web`，以容器方式启动（保证容器 DNS 名为 `api`，符合 Nginx upstream）。
   - 验收请求：
     - `web`: `GET /health`（应通过反代到 `api`）
     - `api`: `GET /health`

## Risks / Trade-offs

- **[风险] 多架构构建耗时/失败率提高** → **缓解**：先支持 `amd64`，再逐步开启 `arm64`；启用 GHA cache；必要时允许 `fail-fast: false` 的矩阵策略。
- **[风险] 标签策略导致用户误用 `latest`** → **缓解**：文档明确推荐使用 `X.Y.Z` 或 `X.Y`；`latest` 仅作为便捷指针。
- **[风险] 镜像发布与 compose 使用路径割裂** → **缓解**：提供可选的 image-based compose 示例，并在 `deployments/README.md` 中写清楚选择依据与验收步骤。
