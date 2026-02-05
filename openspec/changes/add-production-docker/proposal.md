## Why

当前项目在 `dockers/` 目录下有基础的 Docker 配置，但缺乏生产级别的 Docker Compose 配置（健康检查、资源限制、持久化卷、网络隔离、日志管理）。规范的容器化部署方案可降低部署门槛、提高可靠性，并为未来的 Kubernetes 部署奠定基础。

## What Changes

- 优化后端 Dockerfile（多阶段构建、最小化镜像体积）
- 创建生产级 docker-compose.prod.yml（健康检查、restart 策略、资源限制）
- 添加必要的外部服务配置（PostgreSQL、Redis、ChromaDB）
- 持久化卷配置（数据库数据、上传文件、向量存储）
- 环境变量和 secrets 管理
- 提供 .env.example 模板

## Impact

- 受影响的规范：新增 `deployment`
- 受影响的系统：
  - Docker 配置文件
  - 部署文档
  - 配置管理（环境变量支持）
