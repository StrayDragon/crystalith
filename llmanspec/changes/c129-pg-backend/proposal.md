---
depends_on: [c128-asyncify-db-layer]
---

# PostgreSQL 可选后端（外部服务 + 配置切换，greenfield）

> **草案**：调研与前置 review 已完成（2026-10-13），待正式 `/llman-sdd-propose` 充实 design/tasks。
> 决策背景已锁定：外部 PG 服务形态（非 PGlite）、`database.dialect` 配置 opt-in（sqlite 默认档保留）、PG 侧全新启动（不做存量迁移）。
> **排序决策（2026-10-13）**：嵌入线（c130 能力层 → c131 EmbeddingGemma 2）先行，本 change 排其后——c130 的 chunks 元数据迁移（modality/model/dims/origin）按方言可移植设计，pgvector 列与索引一次做对，避免 vec/FTS 层写两遍。

## Why

- 调研确认（2026-10）：现有 `drizzle-orm@0.45.4` 内置 `bun-sql` 驱动与 `pg-core`（含 vector/hnsw 列型），PG 化**零新增 npm 依赖**；Bun 1.4.x 自带 `Bun.sql` 原生 PG 客户端。
- c128 已定型异步数据访问端口（`DbClient`），全部运行时调用点 `await client().xxx`——PG 实现只需替换端口内部，调用点零改动。
- 产品动机：协作/多用户（并发写、RLS）、备份（pg_dump）、中文检索（zhparser/pg_trgm）、知识治理全量 SQL 分析——PG 解锁的方向（详见 2026-10-13 发散分析）。

## What Changes（预研骨架）

- `database:` 配置段激活（现为 v1 死配置）：`dialect: sqlite | postgresql` + 连接串；`CL_DATABASE_*` env；app.schema.gen.json 门禁随动。
- `VectorStore` / `FullTextIndex` 方言接口：sqlite 实现（vec0/FTS5，现状搬移）+ pg 实现（pgvector 0.8 HNSW cosine / tsvector+pg_trgm）。
- pg schema 逐域翻译（schema/ 目录 per-domain 已就位，2026-10-13 拆分）+ drizzle 双迁移目录（sqlite `drizzle/` + pg 新目录）。
- 测试 setup 泛型化 + CI PG service container（compose: `pgvector/pgvector:0.8.x-pg18`）。
- 诊断端点暴露 active dialect；compose 样例与文档。

## Design 输入清单（review 沉淀，正式 propose 时展开）

1. **三处 sqlite 具体类型分叉点**：`db(): Orm`（BunSQLiteDatabase）被 features 持有构建查询；`requireOwnedRow` 泛型约束 `SQLiteTable & AnySQLiteColumn`（notebook-scope.ts:57）；测试 setup 的 `Orm` 硬编码。builder API 双方言同形，但类型需中立化方案。
2. **`rawOne` 怪癖已无消费方**（2026-10-13 isIndexed bugfix 后清零）：pg 实现可安全返回 proper object，无静默破坏面。
3. **epoch 缓存单机边界**（rag/cache.ts 进程内 Map）：单实例部署无碍；多实例/协作化需重做失效模型——本 change 明确不做，写入边界声明。
4. **boot 链**：`createDb`/`db()` 保持同步（bun:sqlite）；PG 方言下连接是异步的——设计「client() 内部 await orm 就绪」或「启动链 async 化」的取舍（c128 design D2 的演进选项在此兑现）。
5. **方言敏感点验证清单**：research-core 原子 `INSERT max(seq)+1`（pg 语法兼容需实测）；`initVecChunks` boot 同步块在 pg 侧的对应物；`toBytes` f32 编码仅 sqlite 需要。
6. **`retrieveSourcesTool(orm, ...)`** 的 orm 注入签名（可测性动机）→ 改收 `DbClient`。
7. **`scheduleSourceSummary` fire-and-forget**：既有后台调度语义，pg 侧保持。
8. 镜像选型基线：`pgvector/pgvector:0.8.x-pg18-trixie`；中文分词（zhparser/pg_jieba）独立决策，首批用 tsvector+pg_trgm。

## 前置已完成（2026-10-13 quick 整备）

- isIndexed 潜伏 bug 修复（raw+first），rawOne 生产消费方清零。
- schema.ts → schema/ per-domain 拆分（DDL 等价性证明：新旧生成 SQL diff 为空）。
- 依赖绿批升级（ai/zod/@ai-sdk 六件套/unpdf/ipaddr.js）至 2026-10 最新。
