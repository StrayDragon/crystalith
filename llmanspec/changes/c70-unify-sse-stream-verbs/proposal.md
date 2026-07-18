---
depends_on:
  - c69-nest-notebook-scoped-paths
---

## Why

流式入口动词不一致：`POST /v2/qa/stream`（大 body）vs `GET /v2/research/:id/stream` vs `GET /v2/studio/slides/:id/*/stream`。文档与客户端心智分裂；c69 嵌套后若不统一，会再改一次路径。

## What Changes

- **约定**：notebook-scoped「进度/订阅」类 SSE → **GET**；交互式生成若需大 payload → **POST**（QA），并在 AsyncAPI/OpenAPI 明确登记。
- **路径**：与 c69 嵌套对齐（`/v2/notebooks/:nid/qa/stream` 等）。
- **前端** `streamRequest` / research / slides 订阅对齐。
- **非目标**：不统一事件 payload 形状（QA chunk vs research progress 可保持差异）。

## Capabilities

- `workspace-api-contract`
- `openapi-and-client-generation`

## Impact

- qa / research / studio routers + asyncapi
- `apps/web/src/api/stream.ts` 与 research/slides hooks
- 流式相关测试
