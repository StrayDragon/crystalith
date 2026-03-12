# Deployments

Docker Compose 部署文件目录。

完整的部署与开发文档见 [docs/doc/deployment.md](../docs/doc/deployment.md)。

## 目录结构

- `prod/` — 生产 compose 文件（core + 可选 overlay）
- `dev/` — 开发依赖 compose 文件（宿主机热重载 + 容器化依赖）
- `test/` — 测试用 compose 文件
- `searxng/` — SearXNG 配置
