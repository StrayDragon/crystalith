# add-v2-data-layer — Tasks

## 1. Drizzle ORM Setup
- [ ] `bun add drizzle-orm drizzle-kit` in server/
- [ ] 创建 `server/src/db/schema.ts` — 核心 8 张 MVP 表 (notebooks/sessions/messages/sources/chunks/outputs/prompt_presets/templates)
- [ ] 创建 `server/src/db/relations.ts` — Drizzle relations 定义
- [ ] 创建 `server/src/db/index.ts` — DB instance 初始化 (bun:sqlite + WAL mode + foreign_keys ON)

## 2. sqlite-vec Integration
- [ ] `bun add sqlite-vec` in server/
- [ ] 创建 `server/src/db/vectors.ts` — vec_chunks 虚拟表 CREATE TABLE + INSERT/SEARCH 包装
- [ ] 验证: vec_chunks 表创建成功，INSERT 向量后可 SELECT

## 3. Migrations
- [ ] `bunx drizzle-kit generate` — 生成初始迁移 SQL
- [ ] `bunx drizzle-kit migrate` — 应用迁移
- [ ] server 启动时调用 `migrate()` 自动 apply

## 4. Types Export
- [ ] Drizzle schema `$inferSelect` / `$inferInsert` 类型导出
- [ ] 类型放置到 `packages/shared/src/db-types.ts` (或直接 import)

## 5. Data Migration (v1 → v2)
- [ ] 创建 `server/src/db/migrate-from-v1.ts` — 一次性脚本
- [ ] 读取 v1 SQLite (`backend/py/data/app.db`) → 映射到 Drizzle schema
- [ ] 读取 v1 ChromaDB → 转为 sqlite-vec 向量
- [ ] 记录 migration 完成标记 (防止重复执行)

## Verification
```bash
cd server
bun test src/db/                    # schema + vector tests
bun run --cwd . dev & sleep 1
curl localhost:8032/v2/notebooks    # 返回空列表
sqlite3 data/crystalith.db ".tables" # 看到所有表
kill %1
```

