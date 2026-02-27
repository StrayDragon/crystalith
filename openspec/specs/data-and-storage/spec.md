# data-and-storage Specification

## Purpose

定义数据库与向量存储的稳定能力边界：关系数据访问、迁移、向量存储选择、按 notebook 隔离与批量检索能力。该规范聚焦存储层的可替换性与一致性约束，避免上层逻辑绑定具体实现。

## Non-goals

- 不定义上层检索策略与提示词逻辑
- 不定义 UI 呈现方式

## Requirements

### Requirement: Relational storage supports SQLite and PostgreSQL
数据访问层 MUST 同时支持 SQLite 与 PostgreSQL。

#### Scenario: Switch relational backend
- **WHEN** 部署将关系数据库从 SQLite 切换为 PostgreSQL（或反之）
- **THEN** 系统 SHALL 仍能完成等价的数据访问与核心功能运行

### Requirement: Migration system is mandatory
数据库变更 MUST 通过迁移系统管理，并提供可执行 CLI 入口。

#### Scenario: Apply migrations on upgrade
- **WHEN** 系统升级引入新的数据库结构变更
- **THEN** 变更 SHALL 通过迁移系统执行，并可通过 CLI 入口运行与回滚（如适用）

### Requirement: Vector storage is provider-configurable
向量存储 MUST 支持 embedded 与 HTTP provider 配置切换。

#### Scenario: Configure vector storage provider
- **WHEN** 用户在配置中选择 embedded 或 HTTP 向量存储 provider
- **THEN** 系统 SHALL 按配置使用对应 provider 并保持上层接口一致

### Requirement: Vector operations are notebook-scoped
向量写入、检索与枚举 MUST 严格按 notebook/source 范围隔离。

#### Scenario: Notebook isolation is enforced
- **WHEN** 用户在 notebook A 中写入向量并在 notebook B 中检索
- **THEN** 系统 SHALL 不返回 notebook A 的向量结果

### Requirement: Batch vector search is supported
向量存储 MUST 支持批量检索；若 provider 不支持批量能力，则系统 MUST 回退为等价单次检索以保持功能可用。

#### Scenario: Batch search falls back safely
- **WHEN** 当前向量 provider 不支持批量检索
- **THEN** 系统 SHALL 回退为等价的单次检索实现而不改变对上层的契约
