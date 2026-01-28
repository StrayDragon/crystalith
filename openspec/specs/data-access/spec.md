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
