# 引用、任务、模型与工作区工具

---

## 引用（Citations）

### `citations-by-message`

- **Domain:** citations
- **Route:** `GET /v2/citations/:messageId`
- **说明:** 获取消息关联的引用列表
- **用户可见:** No（无 FE；消息 citations 随 QA/messages 载荷下发）
- **代码:** `apps/server/src/features/citations/router.ts`、`citations/context.ts`

> NOTE: 2026-07-20 — 无 FE 调用；是否保留另议

---

### `citations-context`

- **Domain:** citations
- **Route:** `GET /v2/notebooks/:nid/citations/context`
- **说明:** 按 chunk/source 返回邻域 before/chunk/after（证据审阅）
- **用户可见:** No（无 FE；CitationDrawer / 证据 UI 已移除）
- **代码:** `apps/server/src/features/citations/router.ts`、`citations/context.ts`

> NOTE: 2026-07-20 — 死产品面（仅测/BDD/spec）；移除候选。`GET /v2/citations/:messageId` 亦无 FE 调用方，另议。

---

## 任务队列（Tasks HTTP）

后台 `TaskQueue` 的 **观测 / 取消** HTTP（**无**创建；**不是** Studio `useOutputQueue`）。

- 创建：仅 `taskQueue.enqueue`（当前唯一生产者：`refine`）
- DB/worker 类型：`refine` | `document_parse`（后者 **无 enqueue 调用方**）
- refine：同请求 `waitForCompletion`，客户端不必轮询

> **2026-07-20 决策：** 无 FE / 无独立产品价值 → **dead-candidate / 可移除**（与 refine 整域一并评估 `TaskQueue` 内部是否仍要留）。

### `tasks-get`

- **Domain:** tasks
- **Route:** `GET /v2/tasks/:id?notebookId=`
- **说明:** 获取单个后台任务状态
- **用户可见:** No
- **代码:** `apps/server/src/features/tasks/router.ts`

> NOTE: 删除候选 — `/v2/tasks*` 整组；旧「Partial / useOutputQueue」为文档错误

---

### `tasks-list-by-notebook`

- **Domain:** tasks
- **Route:** `GET /v2/notebooks/:nid/tasks`
- **说明:** 列出笔记本下任务
- **用户可见:** No
- **代码:** `apps/server/src/features/tasks/router.ts`

> NOTE: 删除候选 — 同上

---

### `tasks-cancel`

- **Domain:** tasks
- **Route:** `POST /v2/tasks/:id/cancel?notebookId=`
- **说明:** 取消排队/运行中任务（`TaskQueue.cancel`）
- **用户可见:** No
- **代码:** `apps/server/src/features/tasks/router.ts`

> NOTE: 删除候选 — 同上

---

## 模型（Models）

### `models-list`

- **Domain:** models
- **Route:** `GET /v2/models`
- **说明:** 列出配置中的 chat/embed 模型
- **用户可见:** Yes（ModelSelector）
- **代码:** `apps/server/src/features/models/router.ts`

> NOTE: 待盘点

---

### `models-get`

- **Domain:** models
- **Route:** `GET /v2/models/:modelId`
- **说明:** 获取单个模型配置
- **用户可见:** Partial
- **代码:** `apps/server/src/features/models/router.ts`

> NOTE: 待盘点

---

### `models-providers`

- **Domain:** models
- **Route:** `GET /v2/models/providers`
- **说明:** 列出已注册 AI provider
- **用户可见:** Partial
- **代码:** `apps/server/src/features/models/router.ts`

> NOTE: 待盘点

---

## 工作区工具（Workspace）

### `workspace-tools-list`

- **Domain:** workspace
- **Route:** `GET /v2/workspace/tools`
- **说明:** Output 类型作为 Studio 工具列表（含 render_descriptor、SLIDES config_schema）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/workspace/router.ts`、`outputs/generator.ts`

> NOTE: 待盘点

---

### `workspace-tools-config`

- **Domain:** workspace
- **Route:** `GET /v2/workspace/tools/:id/config`
- **说明:** 获取工具配置 schema（SLIDES 完整 schema）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/workspace/router.ts`、`studio/config.ts`

> NOTE: 待盘点
