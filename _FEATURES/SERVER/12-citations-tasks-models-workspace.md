# 引用、任务、模型与工作区工具

---

## 引用（Citations HTTP）— **已移除 (c73)**

| 曾有路由                                   | 状态    |
| ------------------------------------------ | ------- |
| `GET /v2/citations/:messageId`             | removed |
| `GET /v2/notebooks/:nid/citations/context` | removed |

已删：`apps/server/src/features/citations/**`。
**仍活：** QA / messages 响应体中的 `citations` 字段；FE `CitationMark` / `CitationPopover` 消费嵌入数据，不调独立 citations HTTP。

> NOTE: **已移除** HTTP；消息内引用 UI 仍 active

---

## 任务队列（Tasks HTTP + TaskQueue）— **已移除 (c73)**

| 曾有路由 / 组件                                                                  | 状态    |
| -------------------------------------------------------------------------------- | ------- |
| `GET /v2/tasks/:id`、`GET /v2/notebooks/:nid/tasks`、`POST /v2/tasks/:id/cancel` | removed |
| `TaskQueue` / `shared/queue.ts` / `features/tasks/*` / DB `tasks`                | removed |

Studio 输出队列是 FE 本地 `useOutputQueue`，从未使用本 API。

> NOTE: **已移除**

---

## 模型（Models）

### `models-list`

- **Domain:** models
- **Route:** `GET /v2/models`
- **说明:** 列出配置中的 chat/embed 模型
- **用户可见:** Yes（ModelSelector）
- **代码:** `apps/server/src/features/models/router.ts`

> NOTE: M4 closed 2026-07-20 — ModelSelector 使用 `role`（`ModelRole`）过滤

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

> NOTE: 待盘点 — c73 后此为类型 registry 的一等 FE 入口（取代已删 `/outputs/types`）

---

### `workspace-tools-config`

- **Domain:** workspace
- **Route:** `GET /v2/workspace/tools/:id/config`
- **说明:** 获取工具配置 schema（SLIDES 完整 schema）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/workspace/router.ts`、`studio/config.ts`

> NOTE: 待盘点
