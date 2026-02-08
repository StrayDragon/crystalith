# data-access Specification

## Purpose
TBD - created by archiving change add-research-workspace. Update Purpose after archive.
## Requirements
### Requirement: 数据访问基础库
系统 SHALL 基于 cl-* SQLAlchemy 公共库实现数据库访问能力。

#### Scenario: 使用共享基础库
- **WHEN** 系统初始化数据库连接与会话
- **THEN** 使用 cl-* 公共库提供的 SQLAlchemy 组件完成初始化

### Requirement: SQLite 与 PostgreSQL 兼容
系统 SHALL 在相同数据访问层下支持 SQLite（开发）与 PostgreSQL（部署），不提供 MySQL 管理器实现。

#### Scenario: 使用 SQLite
- **WHEN** 配置为 SQLite 数据库
- **THEN** 系统正常读写 Notebook 与来源数据

#### Scenario: 使用 PostgreSQL
- **WHEN** 配置为 PostgreSQL 数据库
- **THEN** 系统正常读写 Notebook 与来源数据

### Requirement: Database Migration System
系统 SHALL 使用 Alembic 进行数据库 schema 版本管理。所有 schema 变更 MUST 通过迁移文件记录，支持升级（upgrade）和回滚（downgrade）操作。

#### Scenario: 首次初始化数据库
- **WHEN** 在空数据库上执行 `alembic upgrade head`
- **THEN** 所有表和索引按最新 schema 创建

#### Scenario: 增量迁移
- **WHEN** 新增一个 model 字段并生成迁移文件后执行 upgrade
- **THEN** 数据库新增该字段，已有数据不受影响

#### Scenario: 迁移回滚
- **WHEN** 执行 `alembic downgrade -1`
- **THEN** 数据库 schema 恢复到上一版本

### Requirement: Migration CLI Integration
系统 SHALL 提供 `just db-migrate` 和 `just db-rollback` 命令作为 Alembic 操作的便捷封装。

#### Scenario: 生成迁移文件
- **WHEN** 执行 `just db-migrate` 并提供迁移描述
- **THEN** 在 alembic/versions/ 下生成新的迁移文件
