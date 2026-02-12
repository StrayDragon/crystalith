## ADDED Requirements

### Requirement: Canonical deployments directory
系统 MUST 在仓库根目录提供 `deployments/`，并在其中按场景组织部署清单（至少包含 `deployments/prod/`）。

#### Scenario: 部署目录存在
- **WHEN** 查看仓库的部署清单
- **THEN** 存在 `deployments/` 目录
- **AND** 存在 `deployments/prod/` 作为生产部署入口

### Requirement: Production stack is runnable from deployments/prod
系统 SHALL 在 `deployments/prod/` 提供可直接运行的 Compose 文件与必要的示例配置，使用户可通过单条命令启动完整栈。

#### Scenario: 一键启动命令
- **WHEN** 用户执行 `docker compose -f deployments/prod/docker-compose.yml up -d --build`
- **THEN** Web 与 API 服务成功启动
- **AND** `GET /health` 返回 200

### Requirement: Root-level compatibility entrypoint
系统 MUST 保持 `docker-compose.prod.yml` 作为兼容入口，并确保其与 `deployments/prod/docker-compose.yml` 保持一致，避免产生重复配置漂移。`deployments/prod/docker-compose.yml` MUST 作为单一来源（source of truth）。

#### Scenario: 兼容入口可用
- **WHEN** 用户执行 `docker compose -f docker-compose.prod.yml up -d --build`
- **THEN** 启动结果与 `deployments/prod/docker-compose.yml` 等价

#### Scenario: 兼容入口由生成器维护
- **WHEN** 用户执行 `python scripts/deploy/sync_prod_compose.py`
- **THEN** `docker-compose.prod.yml` 被更新为与 `deployments/prod/docker-compose.yml` 的生成结果一致

#### Scenario: CI 检查不允许漂移
- **WHEN** 在 CI 中执行 `python scripts/deploy/sync_prod_compose.py --check`
- **THEN** 命令返回 0（否则 CI 失败）

### Requirement: Optional offline Ollama profile
系统 SHALL 在 `deployments/prod/docker-compose.yml` 提供可选 `ollama` profile，用于离线体验路径。

#### Scenario: 启用 Ollama profile 启动离线依赖
- **WHEN** 用户执行 `docker compose -f deployments/prod/docker-compose.yml --profile ollama up -d --build`
- **THEN** Compose 启动包含 `ollama` 服务的完整栈

#### Scenario: 离线路径可一行命令完成
- **WHEN** 文档提供离线启动命令
- **THEN** 该命令可在单行内完成（通过命令前缀设置必要 env vars：`OLLAMA_HOST=http://ollama:11434`、`CRYSTALITH_DEFAULT_CHAT_MODEL=qwen-local`、`CRYSTALITH_DEFAULT_EMBEDDING_MODEL=bge-m3-local`）

#### Scenario: 文档提示首次运行需要拉取模型
- **WHEN** 用户按离线启动路径阅读部署文档
- **THEN** 文档提示首次运行需要执行 `ollama pull` 以下载模型

### Requirement: Deployment entry is discoverable
系统 SHALL 在 `deployments/README.md` 记录可用部署场景与对应启动命令，以便用户可快速找到“一键启动”的入口。

#### Scenario: 部署入口可发现
- **WHEN** 用户打开 `deployments/README.md`
- **THEN** 能找到 `deployments/prod/` 的启动命令与最小配置说明
