# add-v2-data-layer — Drizzle ORM + sqlite-vec

## Why

v1 使用 SQLAlchemy[asyncio] + alembic 管理 17 张业务表，ChromaDB 做向量存储（三后端：embedded/http/memory）。v2 桌面 app 定位不需要多数据库/多向量库后端——单 SQLite 文件承载所有数据，sqlite-vec 扩展同库提供向量检索，砍掉 ~2000 行多后端胶水代码。

## What Changes

- **NEW** `server/src/db/schema.ts` — Drizzle ORM schema（17 表映射 + 3 新增 RAG/Eval 表）
- **NEW** `server/src/db/vectors.ts` — sqlite-vec 虚拟表查询包装
- **NEW** `drizzle-orm` + `drizzle-kit` 依赖替换 SQLAlchemy + alembic
- **NEW** `sqlite-vec` npm 依赖
- **NEW** migration 目录 `server/drizzle/`
- **MODIFIED** `server/src/server.ts` — 数据库初始化（WAL mode, foreign_keys ON, sqlite-vec load）

## Capabilities

- data-and-storage (spec delta: 数据库改为 Drizzle + bun:sqlite，向量库改为 sqlite-vec)

## Impact

- **BREAKING**: 数据库从 Postgres/SQLite 双后端降为 SQLite 单后端
- 桌面 app 数据文件 `crystalith.db` 包含业务数据 + 向量索引，同文件可备份
- alembic 迁移历史不迁移，重写即重置（初始 schema + Drizzle Kit 管理后续变更）
