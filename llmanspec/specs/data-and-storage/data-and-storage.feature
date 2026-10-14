# language: zh-CN
# capability: data-and-storage
# purpose: 定义数据层技术选型与内容存储抽象。存储路径治理由 configuration-governance spec 覆盖（data_root 统一派生）。

功能: data-and-storage

  @req:r46
  规则: Database is single SQLite file via bun:sqlite
    系统 MUST 使用 bun:sqlite (C 绑定同步 SQLite) 作为唯一关系数据库。MUST 启用 WAL 模式与 foreign_keys ON。MUST NOT 支持 PostgreSQL。
  @req:r47
  规则: ORM is Drizzle ORM with bun-sqlite driver
    Schema 定义 MUST 使用 Drizzle ORM schema-first 风格 (`sqliteTable()`)。类型推断 MUST 通过 `$inferSelect`/`$inferInsert` 自动导出供前后端共享。
  @req:r48
  规则: Migrations use Drizzle Kit
    数据库变更 MUST 通过 drizzle-kit generate/migrate 管理（schema 变更 SHALL 产出增量 SQL）。初始迁移 MUST 从空库生成。MUST 生产可读 SQL 文件。
  @req:r49
  规则: Vector store is sqlite-vec in-process
    向量检索 MUST 使用 sqlite-vec 扩展（同库零依赖）。MUST 以 `partition by notebook_id` 做多 notebook 隔离。MUST NOT 引入 ChromaDB/lancedb/Qdrant。向量检索延迟与召回规模目标 MUST 由配置承载并以基准测试验证，spec 不锚定具体数值。

    场景: sqlite-vec-knn-with-notebook-isolation
      假如 同一 SQLite 库内已写入多个 notebook 的 vec_chunks 向量
      当 运行 apps/server/tests/db.test.ts 的 sqlite-vec 虚表用例
      那么 同进程内 KNN 检索按 distance 返回最近邻且不依赖外部向量服务
      而且 按 notebook_id 分区使不同 notebook 的向量互相隔离
  @req:r51
  规则: Content storage abstraction
    系统 MUST 提供内容存储抽象（本地文件系统实现）的写入与读取操作以持久化原始上传字节 使 document_parse 任务可重新解析 单二进制架构下 MUST 使用本地文件系统路径

    场景: local-storage-round-trip
      假如 内容存储抽象就绪且单二进制下实现为本地文件系统路径
      当 运行 apps/server/tests/shared/storage.test.ts 的 LocalStorage 用例
      那么 save 后 fetch 可按 key 往返读出原始上传字节供 document_parse 重新解析
      而且 exists 与 delete 的返回语义一致
  @req:r52
  规则: Source raw bytes are persisted and readable back for re-parse
    ingest MUST 通过 contentStorage 持久化来源原始字节，且来源 MUST 可按 sourceId 读回原始内容，以支撑后续再解析（document_parse 类能力）。v2 无任务队列（pipeline 有意同步），队列化 re-parse 需要时另立 capability。

    场景: raw-bytes-roundtrip-via-content-storage
      假如 ingestion 集成环境就绪（tests/sources/parser-selection.test.ts）
      当 完成一次 upload ingest 并以 contentStorage.fetch(sourceId) 读回
      那么 读回字节与上传内容逐字节一致
