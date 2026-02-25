# data-and-storage Specification

## Purpose

定义数据库与向量存储的稳定能力边界：关系数据访问、迁移、向量存储选择、按 notebook 隔离与批量检索能力。

## Non-goals

- 不定义上层检索策略与提示词逻辑
- 不定义 UI 呈现方式

## Requirements

### Requirement: Relational storage supports SQLite and PostgreSQL
数据访问层 MUST 同时支持 SQLite 与 PostgreSQL。

### Requirement: Migration system is mandatory
数据库变更 MUST 通过迁移系统管理，并提供可执行 CLI 入口。

### Requirement: Vector storage is provider-configurable
向量存储 MUST 支持 embedded 与 HTTP provider 配置切换。

### Requirement: Vector operations are notebook-scoped
向量写入、检索与枚举 MUST 严格按 notebook/source 范围隔离。

### Requirement: Batch vector search is supported
向量存储 SHOULD 支持批量检索；不支持时 MUST 可回退为等价单次检索。
