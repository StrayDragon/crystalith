# 深度研究（Research）

HITL 多步研究 Agent + SSE 流。

---

### `research-create`

- **Domain:** research
- **Route:** `POST /v2/research`
- **说明:** 创建研究任务（topic、notebook_id）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/research/router.ts`、`research/agent.ts`

> NOTE: 待盘点

---

### `research-list`

- **Domain:** research
- **Route:** `GET /v2/research`
- **说明:** 列出研究 session（可按 notebook 过滤）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/research/router.ts`

> NOTE: 待盘点

---

### `research-get`

- **Domain:** research
- **Route:** `GET /v2/research/:id`
- **说明:** 获取研究 session 详情与状态
- **用户可见:** Yes
- **代码:** `apps/server/src/features/research/router.ts`

> NOTE: 待盘点

---

### `research-delete`

- **Domain:** research
- **Route:** `DELETE /v2/research/:id`
- **说明:** 删除研究 session
- **用户可见:** Yes
- **代码:** `apps/server/src/features/research/router.ts`

> NOTE: 待盘点

---

### `research-approve`

- **Domain:** research
- **Route:** `POST /v2/research/:id/approve`
- **说明:** HITL 批准当前步骤
- **用户可见:** Yes
- **代码:** `apps/server/src/features/research/router.ts`

> NOTE: 待盘点

---

### `research-modify`

- **Domain:** research
- **Route:** `POST /v2/notebooks/:nid/research/:id/modify`（flat alias 仍存在）
- **说明:** HITL 提交修改后的 search plan 后继续
- **用户可见:** Partial — UI 有查询勾选，但 CTA 只调 `approve`，**不调 modify、不传选中集**
- **代码:** `apps/server/src/features/research/router.ts`；FE `ResearchDetailPanel` / `useResearch`（无 `.modify`）

> NOTE: 产品缺口（API-ALIGNMENT M6）— 接线 modify 或去掉假勾选；勿当死路由删

---

### `research-skip`

- **Domain:** research
- **Route:** `POST /v2/research/:id/skip`
- **说明:** 跳过当前 HITL 步骤
- **用户可见:** Yes
- **代码:** `apps/server/src/features/research/router.ts`

> NOTE: 待盘点

---

### `research-finish`

- **Domain:** research
- **Route:** `POST /v2/research/:id/finish`
- **说明:** 完成研究并生成报告
- **用户可见:** Yes
- **代码:** `apps/server/src/features/research/router.ts`

> NOTE: 待盘点

---

### `research-cancel`

- **Domain:** research
- **Route:** `POST /v2/research/:id/cancel`
- **说明:** 取消进行中的研究
- **用户可见:** Yes
- **代码:** `apps/server/src/features/research/router.ts`

> NOTE: 待盘点

---

### `research-resume`

- **Domain:** research
- **Route:** `POST /v2/research/:id/resume`
- **说明:** 恢复暂停/锁过期的研究
- **用户可见:** Yes
- **代码:** `apps/server/src/features/research/router.ts`、`research/lock.ts`

> NOTE: 待盘点

---

### `research-export`

- **Domain:** research
- **Route:** `POST /v2/research/:id/export`
- **说明:** 导出研究报告（Markdown 等）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/research/router.ts`

> NOTE: 待盘点

---

### `research-stream`

- **Domain:** research
- **Route:** `GET /v2/research/:id/stream`
- **说明:** SSE 推送研究进度与 HITL 事件
- **用户可见:** Yes
- **代码:** `apps/server/src/features/research/router.ts`

> NOTE: 待盘点
