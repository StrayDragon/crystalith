# deployment Specification

## Purpose
TBD - created by archiving change add-production-docker. Update Purpose after archive.
## Requirements
### Requirement: Production Docker Compose
系统 SHALL 提供生产级 docker-compose.prod.yml 配置，包含后端、前端、PostgreSQL 和 ChromaDB 服务。所有服务 MUST 配置健康检查和 restart 策略。

#### Scenario: 一键部署
- **WHEN** 用户执行 `docker compose -f docker-compose.prod.yml up -d`
- **THEN** 所有服务启动成功，后端在 /health 返回 200

#### Scenario: 服务自动恢复
- **WHEN** 后端服务异常崩溃
- **THEN** Docker 自动重启该服务（restart: unless-stopped）

### Requirement: Data Persistence
所有有状态服务 SHALL 使用 Docker volume 持久化数据。容器重建后数据 MUST 不丢失。

#### Scenario: 容器重建数据保留
- **WHEN** 停止并删除所有容器后重新创建
- **THEN** PostgreSQL 数据、ChromaDB 向量数据和上传文件均完好保留

### Requirement: Optimized Container Images
后端和前端 Dockerfile MUST 使用多阶段构建。运行时镜像 MUST 使用非 root 用户。

#### Scenario: 最小化镜像
- **WHEN** 构建后端 Docker 镜像
- **THEN** 最终镜像不包含构建工具和开发依赖，体积小于 500MB

### Requirement: Environment Configuration
系统 SHALL 支持通过环境变量覆盖配置文件中的设置。MUST 提供 .env.example 模板文档。

#### Scenario: 环境变量覆盖
- **WHEN** 设置环境变量 DATABASE_URL=postgresql://...
- **THEN** 系统使用该环境变量值替代 app.yaml 中的 database_url 配置

### Requirement: Production image dependency profiles
系统 MUST 允许生产 Docker 镜像在运行外部 Chroma（HTTP）模式时不安装 embedded Chroma 的 Python 依赖（`chromadb` 及其相关体积较大的依赖），以降低镜像体积并减少维护风险。

#### Scenario: 外部 Chroma 模式构建不安装 chromadb
- **WHEN** 生产 docker-compose 配置使用外部 Chroma 服务（例如 `CHROMA_HOST=chromadb`）
- **THEN** 后端镜像构建阶段通过 uv 的安装选项跳过 `chromadb` 的安装
- **AND** 最终镜像无需通过“安装后卸载依赖清单”的方式瘦身
