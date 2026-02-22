# deployment Specification

## Purpose

定义 Crystalith 的生产部署形态：提供可一键启动的生产级 Docker Compose，约束数据持久化、健康检查与重启策略，并规范镜像构建（多阶段、非 root）与环境变量覆盖的配置入口。

## Related specs

- `GLOSSARY.md`
- `deployments-layout/spec.md`
- `config-management/spec.md`
- `ci-cd/spec.md`

## Requirements
### Requirement: Production Docker Compose
系统 SHALL 提供生产级 Compose 配置，主入口位于 `deployments/prod/docker-compose.yml`。配置 MUST 包含后端、前端、PostgreSQL 和 ChromaDB 服务。所有服务 MUST 配置健康检查和 restart 策略。

### Requirement: Data Persistence
所有有状态服务 SHALL 使用 Docker volume 持久化数据。容器重建后数据 MUST 不丢失。

### Requirement: Optimized Container Images
后端和前端 Dockerfile MUST 使用多阶段构建。运行时镜像 MUST 使用非 root 用户。
最终运行镜像 SHOULD 不包含构建工具与开发依赖（最小化攻击面与体积），但不对具体体积做硬约束。

### Requirement: Environment Configuration
系统 SHALL 支持通过环境变量覆盖配置文件中的设置。MUST 提供 .env.example 模板文档。
例如设置 `DATABASE_URL=postgresql://...` 时，系统 MUST 使用该环境变量值覆盖 `database.url`。

### Requirement: Production image dependency profiles
系统 MUST 允许生产 Docker 镜像在运行外部 Chroma（HTTP）模式时不安装 embedded Chroma 的 Python 依赖（`chromadb` 及其相关体积较大的依赖），以降低镜像体积并减少维护风险。
外部 Chroma（HTTP）模式下，后端镜像构建 SHOULD 通过依赖 profile/安装选项跳过 `chromadb` 安装（而非“先装再卸载”）。
