# data-access Specification

## Purpose

定义数据库访问与迁移策略：基于 cl_sqlalchemyx 提供 Async SQLAlchemy 会话，开发默认 SQLite、部署可切换 PostgreSQL；所有 schema 变更通过 Alembic 迁移管理，并提供 `just` 命令封装常用操作。

## Related specs

- `GLOSSARY.md`
- `backend-module-structure/spec.md`
- `config-management/spec.md`
- `deployment/spec.md`

## Requirements
### Requirement: 数据访问基础库
系统 SHALL 基于 cl-* SQLAlchemy 公共库实现数据库访问能力。

### Requirement: SQLite 与 PostgreSQL 兼容
系统 SHALL 在相同数据访问层下支持 SQLite（开发）与 PostgreSQL（部署），不提供 MySQL 管理器实现。

### Requirement: Database Migration System
系统 SHALL 使用 Alembic 进行数据库 schema 版本管理。所有 schema 变更 MUST 通过迁移文件记录，支持升级（upgrade）和回滚（downgrade）操作。
最小行为：空库执行 `alembic upgrade head` MUST 创建最新 schema；schema 变更 MUST 通过迁移文件记录并可升级/回滚（例如 `alembic downgrade -1`）。

### Requirement: Migration CLI Integration
系统 SHALL 提供 `just db-migrate` 和 `just db-rollback` 命令作为 Alembic 操作的便捷封装。
`just db-migrate <message>` SHOULD 生成新的迁移文件（`alembic/versions/`），`just db-rollback` SHOULD 回滚一版迁移。
