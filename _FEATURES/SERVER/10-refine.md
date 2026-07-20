# 精炼摘要（Refine）

引用感知 RAG 摘要，三种格式（paragraph / bullets / structured）。经 `TaskQueue` enqueue + 同请求 `waitForCompletion`。

> **2026-07-17：** `RefinePanel` UI 已移除。生产 Studio 对 PARAGRAPH / BULLETS / STRUCTURED 使用 `POST /v2/outputs`（`useRefine` → `useOutputQueue`），**不**经本域。
>
> **2026-07-20 决策（以代码为准）：** 无用户入口 → **dead-candidate / 可整域移除**（含依赖的 `/v2/tasks*` 与 `TaskQueue` 若无其他生产者）。

---

### `refine-modes`

- **Domain:** refine
- **Route:** `GET /v2/refine/modes`
- **说明:** 列出格式：paragraph / bullets / structured
- **用户可见:** No
- **代码:** `apps/server/src/features/refine/router.ts`

> NOTE: 删除候选 — 整域 `/v2/refine*`；缩 `structural-refinement` / generation-core refine 条款

---

### `refine-single`

- **Domain:** refine
- **Route:** `POST /v2/refine`（canonical: `/v2/notebooks/:nid/refine`）
- **说明:** 单格式 Refine；经任务队列执行
- **用户可见:** No
- **代码:** `apps/server/src/features/refine/router.ts`、`refine/format.ts`、`refine/retrieve.ts`

> NOTE: 删除候选 — 同上

---

### `refine-batch`

- **Domain:** refine
- **Route:** `POST /v2/refine/batch`（canonical: `/v2/notebooks/:nid/refine/batch`）
- **说明:** 多格式并发生成（共享检索，Semaphore 限流）
- **用户可见:** No
- **代码:** `apps/server/src/features/refine/router.ts`

> NOTE: 删除候选 — 同上
