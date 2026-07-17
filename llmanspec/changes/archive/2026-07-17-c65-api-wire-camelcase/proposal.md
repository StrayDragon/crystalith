---
depends_on: []
---

## Why

v1 Python 留下的 wire 几乎全是 snake_case；前端 UI 已是 camelCase，靠大量 `normalize*` / 手写 `Api*` / `shared-types.ts` 双轨维护。Citation（c64）已证明「双轨」会直接造成 UI bug。

目标：**HTTP JSON 与 packages/shared Zod SSOT、Eden treaty、UI 域字段名三方同形（camelCase）**，删掉 snake→camel 映射层，同时保留 OpenAPI/Scalar 与 Tauri/单二进制路径不受损。

## What Changes

### BREAKING — Wire JSON

- `packages/shared` 内几乎全部请求/响应 Zod 字段改为 camelCase（含信封：`notebookId`、`sessionId`、`sourceIds`、`chunkIds`、`createdAt`、`updatedAt`、`messageId`、`errorCode`、`retryAfter`、`noEvidenceReason`、`sharedState`、`sharedStateRevision`、`configSchema`、`frontendBundle`、`renderDescriptor`、`systemPrompt`、`isBuiltin` 等）。
- Citation 已在 c64 camelCase，本变更将其余域对齐到同一规则。
- Server 所有 `serialize*` / 手写 response 对象 / SSE `done` payload / export JSON 与 Zod 对齐。
- BDD feature、server/web 测试断言、curl 示例全量更新。

### Frontend / Eden

- 业务调用以 `treaty<App>`（`apps/web/src/api/eden.ts`）+ `@crystalith/shared` 为类型来源。
- 删除或大幅收缩：`apps/web/src/api/shared-types.ts`、workspace `Api*` 平行类型、snake→camel 的 `normalize*`（保留纯 UI 派生，如 display label）。
- Streaming 仍可用 `fetch`+SSE，但事件 payload 字段必须 camelCase，类型从 shared streaming schemas 导入。

### Persistence

- 一次性迁移：DB 中 JSON 列里嵌套的旧 snake Citation / 相关结构 → camelCase（至少 `messages.citations`、`outputs.content` 内嵌 citations）。
- Drizzle **表列名**保持现有 snake/SQL 风格（不改 schema 列）。

### Explicit non-goals

- 不改 Tauri/单二进制打包策略；App 仍打本机 HTTP。
- 不恢复 `@hey-api/openapi-ts`；OpenAPI 继续 Zod→openapi + Scalar。
- 不改环境变量 / `config/app.yaml` 键名（除非已是代码内标识符且与 API 无关）。
- 不保留 snake_case wire 兼容层（无双写、无 Accept 版本协商）。

## Capabilities

- `workspace-api-contract`
- `openapi-and-client-generation`
- `frontend-eden-migration`

## Impact

- **对外 BREAKING**：所有 HTTP/SSE JSON 字段名变更；外部脚本必须改。
- **对内**：server serializers、web normalizers、测试、BDD、文档示例大范围改动（估计 120–150+ 触点）。
- OpenAPI/Scalar 文档自动反映 camelCase。
- 本地/Tauri App 与 Web 共用同一 camel 合约，无额外协议。
