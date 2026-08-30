# language: zh-CN
# capability: data-and-storage
# purpose: 定义数据层技术选型与内容存储抽象。存储路径治理由 configuration-governance spec 覆盖（data_root 统一派生）。
# scope: apps/server/src/db/, apps/server/src/shared/storage.ts

功能: data-and-storage

  @req:r29 @human
  场景: Database is single SQLite file via bun:sqlite
    - 系统 MUST 使用 bun:sqlite (C 绑定同步 SQLite) 作为唯一关系数据库。MUST 启用 WAL 模式与 foreign_keys ON。MUST NOT 支持 PostgreSQL。

  @req:r87 @human
  场景: ORM is Drizzle ORM with bun-sqlite driver
    - Schema 定义 MUST 使用 Drizzle ORM schema-first 风格 (`sqliteTable()`)。类型推断 MUST 通过 `$inferSelect`/`$inferInsert` 自动导出供前后端共享。

  @req:r124 @human
  场景: Migrations use Drizzle Kit
    - 数据库变更 MUST 通过 drizzle-kit generate/migrate 管理（schema 变更 SHALL 产出增量 SQL）。初始迁移 MUST 从空库生成。MUST 生产可读 SQL 文件。

  @req:r160 @human
  场景: Vector store is sqlite-vec in-process
    - 向量检索 MUST 使用 sqlite-vec 扩展（同库零依赖）。MUST 以 `partition by notebook_id` 做多 notebook 隔离。MUST NOT 引入 ChromaDB/lancedb/Qdrant。向量检索延迟与召回规模目标 MUST 由配置承载并以基准测试验证，spec 不锚定具体数值。

  @req:r195 @human
  场景: Schema types exported for frontend
    - Drizzle schema 导出的 TS 类型 ($inferSelect/$inferInsert) MUST 通过 packages/shared 暴露给前端 eden RPC 消费，且与 server 侧类型一致。

  @req:r_storage_layer @human
  场景: Content storage abstraction
    - 系统 MUST 提供内容存储抽象（本地文件系统实现）的写入与读取操作以持久化原始上传字节 使 document_parse 任务可重新解析 单二进制架构下 MUST 使用本地文件系统路径

  @req:r_document_parse @human
  场景: document_parse task wired
    - 任务队列 worker MUST 实现 document_parse 任务类型 从存储读取原始字节 经 parse 与 chunk 与 embed 完整流程并写入向量库 不再抛 stub 错误
