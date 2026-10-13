# Design — 数据层异步化端口

## D1 端口形态：终端调用归一，而非 thenable 改造

**问题**：bun-sqlite 的 Drizzle query builder **不是 thenable**（只有 `.all()/.get()/.run()/.iterate()` 同步终端）；而 pg 系驱动的 builder 是 thenable（`await db.select()...` 直接可用）。两者的调用风格在 Drizzle 层面天然分叉。

**选择**：不做 monkey-patch（给 sqlite builder 强行挂 thenable——侵入 drizzle 内部结构，脆）；不要求调用点直接 `await builder`（sqlite 下不成立）。而是引入自有端口，把「终端求值」收归一处：

```ts
// apps/server/src/db/client.ts（形态示意）
import type { SQLWrapper } from 'drizzle-orm';

import type { Orm } from './index.ts';

export interface DbClient {
  all<T>(q: SQLWrapper & { all(): T[] }): Promise<T[]>;
  get<T>(q: SQLWrapper & { get(): T | undefined }): Promise<T | undefined>;
  run(q: SQLWrapper & { run(): unknown }): Promise<void>;
  raw<T>(stmt: SQLWrapper): Promise<T[]>; // sql` 模板直发（vectors/FTS 用）
  tx<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
}
```

- sqlite 实现：`all(q) => Promise.resolve(q.all())` —— 同步结果包 Promise，语义与今日完全一致。
- PG 实现（后续 change）：builder thenable，`all(q) => q`（await 即得数组）；`raw` 走驱动 `sql` 模板；`tx` 用 `sql.begin`。**调用点零改动**——这是本端口存在的全部理由。

**权衡记录**：也曾考虑按域拆 repository/service 函数层（更「干净」但重写量大、与本次机械迁移目标不符），否决。端口只收终端求值，不改链式 builder 构造过程。

## D2 调用点迁移模式

```ts
// 之前
const rows = db().select().from(notebooks).orderBy(desc(notebooks.updatedAt)).all();
// 之后
const rows = await client().all(db().select().from(notebooks).orderBy(desc(notebooks.updatedAt)));
```

- `client()` 是与 `db()` 同生命周期的模块级访问器（同一 orm 单例的端口视图）；测试里 `resetDb(orm)` 后 `client()` 跟随，无需额外 reset。
- raw SQL 场景（`vectors.ts` / `keyword-strategy.ts` / `page-index-strategy.ts` / `schema.ts` 内的 `orm.all(sql\`...\`)`）改走 `raw()`。
- 迁移后 handler 内 DB 调用一律 `await`；Elysia handler 已是 async，无签名变化。

## D3 事务收编

全 src 唯一手工事务在 `db/vectors.ts` cosine 重建（`BEGIN IMMEDIATE` → DDL + 批量 INSERT → `COMMIT`，失败 ROLLBACK 保旧表）。

**实施修订（apply 期）**：`initVecChunks` 整体属于 boot 链（`createDb` 同步调用，早于任何可 await 的调用方），其 DDL 与 legacy 重建保持**同步直调 orm**，不强行搬进 `tx()`——否则 `createDb`/`db()` 被迫异步化，超本 change 边界（那是 PG change 启动链的工作）。`tx()` 端口本身落地并由 `db-client.test.ts` 覆盖语义（成功提交 / 失败回滚重抛），PG 实现用 `sql.begin`（savepoint 语义天然满足）；端口文档注明「tx 内不可重入」。

## D3a 实施期发现：bun-sqlite 原生 SQL 的 `orm.get()` 数组形态怪癖

drizzle bun-sqlite 对 `sql\`\``模板的`.get()` 返回**数组形态行**（`SELECT COUNT(*) AS c`→`[1]`，非 `{c:1}`；`.all()`不受影响，正常对象形态）。唯一受影响的现存调用是`keyword-strategy.ts`的`isIndexed`——`row?.c` 恒 undefined → 恒 false（**潜伏 bug，2026-10-12 实证**）。处置：

- 端口 `rawOne` 透传 `orm.get`（位级兼容，含怪癖）；`raw` 走 `orm.all`（对象形态，与 vectors.ts 现行为一致）。
- 修复 `isIndexed` 超出「行为零变化」边界 → 记 `docs/known-issues.md` 台账，单独 bugfix 承接。

## D4 明确的非目标（防 scope creep）

- 不引入 pg 驱动、`database.dialect` 配置、连接工厂分流——那是后续 PG change 的第一课。
- 不动 `db/index.ts` 的 PRAGMA / sqlite-vec 加载 / 迁移应用逻辑（`createDb` 返回值与 `Orm` 类型不变）。
- 不动 epoch 缓存（进程内 Map，与端口无关）、不动 chunker/multi-query 等纯逻辑。

## D5 迁移与验收策略

- **先加后删**：批次 A 落端口（旁路新增）→ 批次 B 按域分批迁移调用点（每片 `just qa` 绿即 commit）→ 批次 C 清尾 + 完成判据。
- **完成判据（在 change 分支测量，相对 merge-base）**：
  1. 构建器终端清零：`grep -rnE "\.(all|get|run|iterate)\(\)" apps/server/src --include='*.ts'` 仅剩 `db/client.ts`（端口实现）与 `db/vectors.ts` 的 `initVecChunks` boot 块（见 D3 修订）；
  2. 原生 SQL 终端清零：`grep -rnE "\b(orm|db\(\))\.(all|get|run)\b" apps/server/src --include='*.ts'` 同样仅剩上述豁免面；
  3. tests 判据（apply 期修订）：测试的**被测路径**（断言、helper、经端口/HTTP 的调用）必须 await 化且无悬浮异步调用；**seeding 造数**（`orm/getOrm()` 直连 insert/select）允许保留——测试不是生产接缝，PG change 的测试策略届时统一处理（此处硬磨 60 个已绿文件只引入回归风险，无端口收益）；
  4. `just qa` 全绿 + `just test-bdd` 绿。
- 红批遇阻降级：某域迁移引入行为回归且 1 个批次日内修不完 → 回滚该片、记 `docs/known-issues.md`、裁出本 change（沿用 c127 纪律）。

## D6 测试边界（seam）

本 change 无 `.feature` 新场景——行为合约不变，测试边界 = 既有 harness 全量复用：

- `just qa`：server/shared 单测（`--parallel` 逐文件隔离）、web Rstest、e2e @p0；
- `just test-bdd`：CRUD 子集 BDD；
- 唯一新增测试点：`db/client.ts` 端口自身的最小单测（all/get/run/tx 语义，含 tx 失败回滚），挂靠既有 `apps/server/tests/db.test.ts` 体系。
