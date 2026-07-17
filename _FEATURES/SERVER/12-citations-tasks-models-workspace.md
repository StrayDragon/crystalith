# 引用、任务、模型与工作区工具

---

## 引用（Citations）

### `citations-by-message`

- **Domain:** citations
- **Route:** `GET /v2/citations/:messageId`
- **说明:** 获取消息关联的引用列表
- **用户可见:** Yes
- **代码:** `apps/server/src/features/citations/router.ts`、`citations/context.ts`

> NOTE: 待盘点

---

### `citations-context`

- **Domain:** citations
- **Route:** `GET /v2/notebooks/:nid/citations/context`
- **说明:** 按 chunk/source 查询引用上下文（导出/高亮）
- **用户可见:** Partial
- **代码:** `apps/server/src/features/citations/router.ts`

> NOTE: 待盘点

---

## 任务队列（Tasks）

### `tasks-get`

- **Domain:** tasks
- **Route:** `GET /v2/tasks/:id`
- **说明:** 获取单个后台任务状态
- **用户可见:** Partial（`useOutputQueue`）
- **代码:** `apps/server/src/features/tasks/router.ts`

> NOTE: 待盘点

---

### `tasks-list-by-notebook`

- **Domain:** tasks
- **Route:** `GET /v2/notebooks/:nid/tasks`
- **说明:** 列出笔记本下任务
- **用户可见:** Partial
- **代码:** `apps/server/src/features/tasks/router.ts`

> NOTE: 待盘点

---

### `tasks-cancel`

- **Domain:** tasks
- **Route:** `POST /v2/tasks/:id/cancel`
- **说明:** 取消排队/运行中任务
- **用户可见:** Partial
- **代码:** `apps/server/src/features/tasks/router.ts`

> NOTE: 待盘点

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
