## Why

当前数据库 schema 管理依赖手动脚本和 `db-init` 命令，缺乏正式的迁移系统。随着功能迭代，表结构变更变得频繁，手动迁移容易遗漏字段变更、导致数据丢失或升级失败。引入 Alembic 数据库迁移系统可以实现版本化、可回滚的 schema 管理。

## What Changes

- 引入 Alembic 作为数据库迁移工具
- 为当前 schema 生成初始迁移文件
- 修改 `db-init` 命令使用 Alembic 迁移替代直接 create_all
- 添加 `just db-migrate` 和 `just db-rollback` 命令
- 支持 SQLite 和 PostgreSQL 的迁移

## Impact

- 受影响的规范：`data-access`（MODIFIED）
- 受影响的系统：
  - 数据库初始化流程
  - just 任务定义
  - 开发和部署工作流
