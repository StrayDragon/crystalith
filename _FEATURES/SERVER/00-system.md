# 系统（System）

健康检查、API 文档与根路由。

---

### `health-basic`

- **Domain:** system
- **Route:** `GET /health`
- **说明:** 基础存活检查，返回 `{ status, version }`
- **用户可见:** Partial（诊断间接使用）
- **代码:** `apps/server/src/server.ts`

> NOTE: 待盘点

---

### `health-dependencies`

- **Domain:** system
- **Route:** `GET /health/dependencies`
- **说明:** 探测核心与可选依赖（SearXNG、Chroma 占位等）
- **用户可见:** Yes（诊断对话框）
- **代码:** `apps/server/src/server.ts`

> NOTE: 待盘点

---

### `openapi-json`

- **Domain:** system
- **Route:** `GET /openapi.json`
- **说明:** OpenAPI 3 规范 JSON（Zod 手写注册）
- **用户可见:** API-only
- **代码:** `apps/server/src/openapi.ts`、`server.ts`

> NOTE: 待盘点

---

### `openapi-scalar-ui`

- **Domain:** system
- **Route:** `GET /openapi`
- **说明:** Scalar API 文档 UI
- **用户可见:** API-only
- **代码:** `apps/server/src/server.ts`（`@elysiajs/openapi`）

> NOTE: 待盘点

---

### `asyncapi-json`

- **Domain:** system
- **Route:** `GET /asyncapi.json`
- **说明:** AsyncAPI 文档（SSE/流式通道描述）
- **用户可见:** API-only
- **代码:** `apps/server/src/asyncapi.ts`

> NOTE: 待盘点

---

### `v2-root-health`

- **Domain:** system
- **Route:** `GET /v2/`、`GET /v2/health`
- **说明:** v2 API 根信息与简化健康
- **用户可见:** API-only
- **代码:** `apps/server/src/server.ts`

> NOTE: 待盘点
