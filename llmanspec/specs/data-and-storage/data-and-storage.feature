# language: zh-CN
# capability: data-and-storage
# purpose: 定义数据层技术选型与内容存储抽象。存储路径治理由 configuration-governance spec 覆盖（data_root 统一派生）。
# scope: src/, tests/

功能: data-and-storage

  @req:r29 @human
  场景: Database is single SQLite file via bun:sqlite
    - 系统 MUST 使用 bun:sqlite (C 绑定同步 SQLite) 作为唯一关系数据库。MUST 启用 WAL 模式与 foreign_keys ON。MUST NOT 支持 PostgreSQL。

  @req:r87 @human
  场景: ORM is Drizzle ORM with bun-sqlite driver
    - Schema 定义 MUST 使用 Drizzle ORM schema-first 风格 (`sqliteTable()`)。类型推断 MUST 通过 `$inferSelect`/`$inferInsert` 自动导出供前后端共享。

  @req:r124 @human
  场景: Migrations use Drizzle Kit
    - 数据库变更 MUST 通过 drizzle-kit generate/migrate 管理。初始迁移 MUST 从空库生成。MUST 生产可读 SQL 文件。

  @req:r160 @human
  场景: Vector store is sqlite-vec in-process
    - 向量检索 MUST 使用 sqlite-vec 扩展（同库零依赖）。MUST 以 `partition by notebook_id` 做多 notebook 隔离。MUST NOT 引入 ChromaDB/lancedb/Qdrant。

  @req:r195 @human
  场景: Schema types exported for frontend
    - Drizzle schema 导出的 TS 类型 ($inferSelect/$inferInsert) MUST 通过 packages/shared 暴露给前端 eden RPC 消费。

  @req:r_storage_layer @human
  场景: Content storage abstraction
    - 系统 MUST 提供内容存储抽象（本地文件系统实现）的写入与读取操作以持久化原始上传字节 使 document_parse 任务可重新解析 单二进制架构下 MUST 使用本地文件系统路径

  @req:r_document_parse @human
  场景: document_parse task wired
    - 任务队列 worker MUST 实现 document_parse 任务类型 从存储读取原始字节 经 parse 与 chunk 与 embed 完整流程 不再抛 stub 错误

  @req:r29 @human
  场景: sqlite-open-wal
    - 必须成立：当 server 启动；那么 bun:sqlite 创建/打开 crystalith.db，WAL 模式启用
    当 server 启动
    那么 bun:sqlite 创建/打开 crystalith.db，WAL 模式启用

  @req:r87 @human
  场景: drizzle-infer-table-type
    - 必须成立：当 开发者定义 notebooks 表；那么 Drizzle schema 类型通过 $inferSelect 自动推断 Notebook 类型
    当 开发者定义 notebooks 表
    那么 Drizzle schema 类型通过 $inferSelect 自动推断 Notebook 类型

  @req:r124 @human
  场景: drizzle-kit-incremental-migration
    - 必须成立：当 新增一个 column；那么 drizzle-kit generate 产出增量 SQL，apply 后数据库更新
    当 新增一个 column
    那么 drizzle-kit generate 产出增量 SQL，apply 后数据库更新

  @req:r160 @human
  场景: sqlitevec-topk-latency
    - 必须成立：当 1万 chunk 向量检索；那么 sqlite-vec 返回 top-10，p50 < 10ms
    当 1万 chunk 向量检索
    那么 sqlite-vec 返回 top-10，p50 < 10ms

  @req:r195 @human
  场景: shared-notebook-type-parity
    - 必须成立：当 前端 import Notebook 类型；那么 TS 编译通过，类型与 server 一致
    当 前端 import Notebook 类型
    那么 TS 编译通过，类型与 server 一致

  @req:r_storage_layer @human
  场景: save_then_fetch
    - 必须成立：假如 上传一个 PDF；当 摄取解析后；那么 系统 SHALL 经存储抽象持久化原始字节 且后续读取能取回相同字节
    假如 上传一个 PDF
    当 摄取解析后
    那么 系统 SHALL 经存储抽象持久化原始字节 且后续读取能取回相同字节

  @req:r_document_parse @human
  场景: parse_task_completes
    - 必须成立：假如 存在已持久化的 source；当 document_parse 任务入队执行；那么 系统 SHALL 完成 parse 与 chunk 与 embed 全流程并写入向量库
    假如 存在已持久化的 source
    当 document_parse 任务入队执行
    那么 系统 SHALL 完成 parse 与 chunk 与 embed 全流程并写入向量库
