---
depends_on: []
---

## Why

c67 硬化了 notebook 归属，但列表端点仍大量返回**裸数组**（无 `total`），OpenAPI/`registerApiDoc` 与真实 handler 路径存在漂移（citations context、AsyncAPI research stream），且多数路由未挂完整 `query`/`response` Zod。这对 Eden 类型质量、Scalar 文档可信度与前端分页 UX 都构成噪音。

## What Changes

- **分页契约统一**：对 notebook-scoped / 可增长列表（至少 messages、sessions、sources、outputs、research、studio slides、tasks）采用 shared `PaginationParamsSchema` + `PaginatedSchema`（`{ items, total, offset, limit }`）。**BREAKING** 对返回裸数组的列表端点。
- **OpenAPI 对齐**：修正 `registerApiDoc` 漂移路径（至少 citations context → `/v2/notebooks/:nid/citations/context`）；AsyncAPI research stream 地址与实现一致；关键列表/单资源路由补齐 query/response schema 挂载。
- **非目标**：不做 notebook 路径嵌套 BREAKING（Phase 3）；不改 SSE 动词统一（Phase 4）；不修 c13 pending tasks；不强制 OpenAPI 运行时生成若 Zod v4 仍 stack-overflow（可记录为 follow-up，以 registerApiDoc + 路由挂载为准）。

## Capabilities

- `workspace-api-contract`
- `openapi-and-client-generation`

## Impact

- Server routers：messages、sessions、sources、outputs、research、studio、tasks、citations（docs）
- `packages/shared`：分页响应类型复用；可能新增 list response helpers
- Web：凡消费裸数组列表的 hooks（messages/sessions/sources/outputs/research/slides）需读 `items`/`total`
- AsyncAPI：`apps/server/src/asyncapi.ts`
- 测试：server 列表分页契约；web hooks MSW/fixture 更新；`just qa`
