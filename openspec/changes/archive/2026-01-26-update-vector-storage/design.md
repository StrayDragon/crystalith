## Context

- 当前本地向量存储由 `SQLiteVectorStore` 实现，依赖 sqlite-vss 扩展；缺失时会降级到暴力搜索并产生告警。
- 需求明确切换到“完全本地”的 Chroma 嵌入式持久化方案。

## Goals / Non-Goals

- Goals:
  - 提供嵌入式 Chroma 本地持久化存储（无需部署服务）。
  - 默认关闭 Chroma 遥测，可通过配置开启。
  - 移除 sqlite-vss 依赖与加载逻辑。
  - 默认存储路径放在 `./data` 目录内。
  - 保持现有 `VectorStore` 接口语义。
  - 提供旧 `./data/vectors.db` 的迁移路径。
- Non-Goals:
  - 不引入 Chroma Server 部署模式。
  - 不做新的性能基准体系。

## Decisions

- 使用 `chromadb.PersistentClient` 作为本地持久化存储，路径默认 `./data/chroma`。
  - 遥测默认关闭（`anonymized_telemetry=false`）。
- 采用统一 ID 与 metadata 方案，记录 `notebook_id/source_id/chunk_id` 以支持过滤删除。
- 保留旧 SQLite 读取能力仅用于迁移。
- `VectorStorageFactory` 支持 `memory` 与 `chroma`；`sqlite` 作为本地 Chroma 的兼容别名。

## Risks / Trade-offs

- 嵌入式 Chroma 不适合多进程/多节点共享。
- 迁移会产生一次性成本，需要明确操作与回滚。
- 本地磁盘占用增加（索引文件）。

## Migration Plan

- 提供迁移 helper：读取 `./data/vectors.db` 并写入 `./data/chroma`。
- 文档中说明配置变更与迁移步骤；迁移完成前保留旧库作为备份。

## Open Questions

- 暂无。
