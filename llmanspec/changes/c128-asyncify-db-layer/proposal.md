---
depends_on: []
needs_specs_change: false
---

# 数据层异步化：db/client 端口接缝

> 本 change 是「PostgreSQL 可选后端」系列的**前置**：只做异步化与接缝抽取，行为零变化，不引入任何 pg 代码、配置或 spec 变更。后续 PG change 将直接引用本次定型的端口 API。

## Why

- 当前全部数据访问走 `drizzle-orm/bun-sqlite` 的**同步**终端调用（`.all() / .get() / .run()`，无 `await`），约 40 个 src 文件 + 60 个 test 文件。
- 目标 PG 后端的全部候选驱动（`Bun.sql` / postgres.js / node-postgres）都是异步 API；同步调用点不异步化，PG 接入无从谈起。
- 调研已确认（2026-10）：现有 `drizzle-orm@0.45.4` 自带 `bun-sql` 驱动与 `pg-core`（含 vector/hnsw），PG 化不需要换依赖——**唯一的大面积改动就是这层调用风格**。把它拆成独立前置 change，可以让 PG change 退化为纯增量（pg schema、pgvector/FTS 方言实现、config 接线），两个 change 的 diff 都可审。
- 端口层（all/get/run/tx）的形态会在本 change 被 100+ 调用点检验，提前定型，避免在方言压力下边迁移边设计。

## What Changes

- 新增 `apps/server/src/db/client.ts`：异步数据访问端口（`all` / `get` / `run` / `raw` / `tx`），sqlite 实现 = 现有 bun:sqlite 同步结果包 Promise；`db()` 单例与 `resetDb()` 语义不变。
- 全部调用点终端 `.all()/.get()/.run()` 迁移为 `await client.xxx(builder)`；Elysia handler 本就是 async，改造机械。
- `db/vectors.ts` 中唯一一处手工事务（`BEGIN IMMEDIATE`/`COMMIT`，cosine 重建）收编进端口 `tx()`。
- 测试文件同步 `await` 化（每文件自给自足纪律不变）。
- **不做**：任何 pg 代码、`database.dialect` 配置、死配置段激活、compose、spec 改写、`vec_chunks`/`chunks_fts` SQL 方言调整（只换执行通道）。

## Capabilities

- `data-and-storage`：r46 合约不受影响——底层仍是同一个 bun:sqlite 实例（C 绑定同步 SQLite），仅调用侧包 Promise；存储选型、WAL/FK PRAGMA、Drizzle schema、drizzle-kit 迁移均不动。
- 无 MUST/SHALL 行为合约变更 → 不编辑 `llmanspec/specs/**`。

## Impact

- **行为**：零变化。单请求内 DB 操作顺序不变（await 已 resolve 的 Promise 不重排）；跨请求交错在 WAL 单写者 + 既有并发门禁下无新风险。
- **性能**：await resolved promise 开销纳秒级，可忽略。
- **重点回归面**：research SSE run-loop 与后台 drain（`setupIntegrationEnv` 已覆盖）、sources pipeline、epoch 缓存接线。
- **验收口径**（与用户已确认）：`just qa` 全绿（含 e2e @p0）+ `just test-bdd` 绿；不新增测试面，仅改造既有测试调用风格。完成判据中的 grep 计数在 change 分支上测量（相对 merge-base）。
