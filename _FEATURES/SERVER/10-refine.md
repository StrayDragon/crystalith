# 精炼摘要（Refine）

引用感知 RAG 摘要，三种格式（paragraph / bullets / structured）。

> **2026-07-17：** `RefinePanel` UI 已移除。Server `/v2/refine*` API **保留**。生产 Studio 路径对 PARAGRAPH / BULLETS / STRUCTURED 使用 `POST /v2/outputs`，不经 Refine 面板。

---

### `refine-modes`

- **Domain:** refine
- **Route:** `GET /v2/refine/modes`
- **说明:** 列出格式：paragraph / bullets / structured
- **用户可见:** API-only（RefinePanel 已移除）
- **代码:** `apps/server/src/features/refine/router.ts`

> NOTE: 待盘点

---

### `refine-single`

- **Domain:** refine
- **Route:** `POST /v2/refine`
- **说明:** 单格式 Refine；经任务队列执行
- **用户可见:** API-only
- **代码:** `apps/server/src/features/refine/router.ts`、`refine/format.ts`、`refine/retrieve.ts`

> NOTE: 待盘点

---

### `refine-batch`

- **Domain:** refine
- **Route:** `POST /v2/refine/batch`
- **说明:** 多格式并发生成（共享检索，Semaphore 限流）
- **用户可见:** API-only
- **代码:** `apps/server/src/features/refine/router.ts`

> NOTE: 待盘点
