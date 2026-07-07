# add-v2-data-layer — Tasks

## 1. Shared Schemas (@crystalith/shared)
- [ ] 创建 `packages/shared/src/schemas/` — 所有 Zod schema（SSOT）
  - [ ] `common.ts` — ErrorEnvelope, Pagination, Citation
  - [ ] `notebook.ts`
  - [ ] `session.ts`
  - [ ] `message.ts`
  - [ ] `source.ts`
  - [ ] `qa.ts`
  - [ ] `output.ts` — FAQ, GUIDE, TIMELINE, MINDMAP, QUIZ, BRIEFING
  - [ ] `research.ts`
  - [ ] `analysis.ts`
  - [ ] `studio.ts`
  - [ ] `refine.ts`
  - [ ] `model.ts` — ModelConfig, ProviderConfig
  - [ ] `template.ts`
  - [ ] `task.ts`
- [ ] 创建 `packages/shared/src/types/index.ts` — z.infer 推导类型
- [ ] `bun add zod` to server + frontend（shared package peerDep）

## 2. Drizzle ORM Setup
- [ ] `bun add drizzle-orm drizzle-kit` in server/
- [ ] 创建 `server/src/db/schema.ts` — 全 17 张表 Drizzle 定义
- [ ] 创建 `server/src/db/relations.ts` — Drizzle relations 定义
- [ ] 创建 `server/src/db/index.ts` — DB instance 初始化 (bun:sqlite + WAL mode + foreign_keys ON)

## 3. sqlite-vec Integration
- [ ] `bun add sqlite-vec` in server/
- [ ] 创建 `server/src/db/vectors.ts` — vec_chunks 虚拟表 CREATE TABLE + INSERT/SEARCH 包装
- [ ] 验证: vec_chunks 表创建成功，INSERT 向量后可 SELECT

## 4. Migrations
- [ ] `bunx drizzle-kit generate` — 生成初始迁移 SQL
- [ ] `bunx drizzle-kit migrate` — 应用迁移
- [ ] server 启动时调用 `migrate()` 自动 apply

## 5. Data Migration (v1 → v2)
- [ ] 创建 `server/src/db/migrate-from-v1.ts` — 一次性脚本
- [ ] 读取 v1 SQLite (`backend/py/data/app.db`) → 映射到 Drizzle schema
- [ ] 读取 v1 ChromaDB → 转为 sqlite-vec 向量
- [ ] 记录 migration 完成标记 (防止重复执行)

## 6. OpenAPI / AsyncAPI Serving
- [ ] `bun add @asteasolutions/zod-to-openapi` in server/
- [ ] 创建 `server/src/openapi.ts` — 从 Zod schema 生成 OpenAPI 3.0 doc
- [ ] 创建 `server/src/asyncapi.ts` — AsyncAPI 3.0 doc（流式端点手动定义）
- [ ] 挂载 `GET /openapi.json` 和 `GET /asyncapi.json` 到 Elysia app
- [ ] 自动化: server 启动时自动生成 OpenAPI/AsyncAPI doc

## Verification
```bash
cd server
bun test src/db/                    # schema + vector tests
bun test packages/shared/           # schema validation tests
bun run --cwd . dev & sleep 1
curl localhost:8032/v2/notebooks    # 返回空列表
curl localhost:8032/openapi.json    # 返回完整 OpenAPI 3.0 doc
curl localhost:8032/asyncapi.json   # 返回 AsyncAPI 3.0 doc
sqlite3 data/crystalith.db ".tables" # 看到 17 张表
kill %1
```
