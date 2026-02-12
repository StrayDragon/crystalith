## MODIFIED Requirements

### Requirement: Production Docker Compose
系统 SHALL 提供生产级 Compose 配置，主入口位于 `deployments/prod/docker-compose.yml`，并在仓库根目录提供兼容入口 `docker-compose.prod.yml`。配置 MUST 包含后端、前端、PostgreSQL 和 ChromaDB 服务。所有服务 MUST 配置健康检查和 restart 策略。

#### Scenario: 一键部署
- **WHEN** 用户执行 `docker compose -f deployments/prod/docker-compose.yml up -d`
- **THEN** 所有服务启动成功，后端在 /health 返回 200

#### Scenario: 根目录兼容入口
- **WHEN** 用户执行 `docker compose -f docker-compose.prod.yml up -d`
- **THEN** 启动结果与 `deployments/prod/docker-compose.yml` 等价

#### Scenario: 服务自动恢复
- **WHEN** 后端服务异常崩溃
- **THEN** Docker 自动重启该服务（restart: unless-stopped）
