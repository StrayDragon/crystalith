# add-v2-data-layer — Tasks

## 1. Shared Schemas (@crystalith/shared)
- [x] 创建 `packages/shared/src/schemas/` — 所有 Zod schema（SSOT）
  - [x] `common.ts` — ErrorEnvelope, Pagination, Citation
  - [x] `notebook.ts`
  - [x] `session.ts`
  - [x] `message.ts`
  - [x] `source.ts`
  - [x] `qa.ts` — (merged into `streaming/qa-stream.ts`)
  - [x] `output.ts` — FAQ, GUIDE, TIMELINE, MINDMAP, QUIZ, BRIEFING, SLIDES, PARAGRAPH, BULLETS, STRUCTURED
  - [x] `research.ts`
  - [x] `analysis.ts`
  - [x] `studio.ts`
  - [x] `refine.ts`
  - [x] `model.ts` — ModelConfig, ProviderConfig
  - [x] `template.ts`
  - [x] `task.ts`
  - [x] `eval.ts` — EvalDataset, EvalItem, EvalRun, EvalRunItem, EvalMetrics
  - [x] `streaming/qa-stream.ts`, `streaming/research-progress.ts`
- [x] 创建 `packages/shared/src/types/index.ts` — z.infer 推导类型
- [x] `bun add zod` to server + frontend（shared package peerDep）

## 2. Drizzle ORM Setup
- [x] `bun add drizzle-orm drizzle-kit` in server/
- [x] 创建 `server/src/db/schema.ts` — 全 20 张表 Drizzle 定义 (16 v1 + 4 eval)
- [x] 创建 `server/src/db/schema.ts` — Drizzle relations 定义 (inline)
- [x] 创建 `server/src/db/index.ts` — DB instance 初始化 (bun:sqlite + WAL mode + foreign_keys ON)

## 3. sqlite-vec Integration
- [x] `bun add sqlite-vec` in server/
- [x] 创建 `server/src/db/vectors.ts` — vec_chunks 虚拟表 CREATE TABLE + INSERT/SEARCH 包装
- [x] 验证: vec_chunks 表创建成功，INSERT 向量后可 SELECT

## 4. Migrations
- [x] `bunx drizzle-kit generate` — 生成初始迁移 SQL (0000_daily_madame_web.sql)
- [x] server 启动时调用 `migrate()` 自动 apply

## 5. Data Migration (v1 → v2)
- [ ] 创建 `server/src/db/migrate-from-v1.ts` — 一次性脚本 (defer → c14-add-v2-cleanup-delivery)

## 6. OpenAPI / AsyncAPI Serving
- [x] `bun add @asteasolutions/zod-to-openapi` in server/
- [x] 创建 `server/src/openapi.ts` — 从 Zod schema 生成 OpenAPI 3.1 doc
- [x] 创建 `server/src/asyncapi.ts` — AsyncAPI 3.0 doc（流式端点手动定义）
- [x] 挂载 `GET /openapi.json` 和 `GET /asyncapi.json` 到 Elysia app
- [x] 自动化: server 启动时自动生成 OpenAPI/AsyncAPI doc

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
