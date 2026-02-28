## 1. 发布工作流（GHCR）

- [x] 1.1 新增 GitHub Actions 工作流：tag（`vX.Y.Z`）触发构建并推送 `crystalith-api` 与 `crystalith-web` 到 GHCR（含 `packages: write` 权限）。
- [x] 1.2 引入 Buildx（必要时 QEMU）并启用 GHA cache，支持 `linux/amd64`（可选扩展到 `linux/arm64`）。
- [x] 1.3 统一标签与 OCI labels：SemVer 标签 + `sha-<shortsha>`，并写入 source/revision/version。

## 2. 版本一致性守护

- [x] 2.1 发布前校验：tag 版本与仓库版本源一致（例如后端/前端版本文件）；不一致则 fail-fast。

## 3. 发布后最小验收

- [x] 3.1 在发布工作流中增加 post-push 验收：从 GHCR 拉取刚发布镜像启动最小拓扑并验证 `GET /health`（api 与 web 反代链路）。

## 4. 文档与使用路径

- [x] 4.1 在部署文档中补充“从 GHCR 拉取镜像”的使用示例（与 build-from-source 路径并存），并说明推荐的标签选择（优先 `X.Y.Z`）。

## 5. Verification

- [ ] 5.1 触发一次预发布（可选：workflow_dispatch 或 pre-release tag）验证镜像推送、标签与 OCI labels 正确。
- [ ] 5.2 从 GHCR 拉取并运行 `api/web` 镜像，确认 `/health` 与 `web`→`api` 反代可用。
