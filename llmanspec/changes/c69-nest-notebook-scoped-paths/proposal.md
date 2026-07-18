---
depends_on:
  - c68-align-openapi-and-pagination
---

## Why

c67 用必填 `?notebookId=` 硬化了归属，但 outputs / research / qa / refine / studio / 单条 sources 仍走**扁平**路径。path 与 body/query 双轨并存，增加 Eden 调用面复杂度，也不利于 c13 在 route-group 上挂 notebook middleware。

## What Changes

- **Canonical 嵌套路径**：notebook-scoped 资源统一为 `/v2/notebooks/:nid/<domain>/...`（outputs、research、qa、refine、studio/slides、sources/:sid 单资源、sources/upload 等）。
- **Deprecation alias**：保留现有扁平路径 **1 个 release**（或明确窗口），响应/文档标注 Deprecation；新前端只走嵌套。
- **Eden/web 迁移**：封装或直接改 `api.v2.notebooks({ nid }).…` 调用树。
- **BREAKING**：alias 移除后扁平路径 410/404；本 change 内前端必须切完。

## Capabilities

- `workspace-api-contract`
- `openapi-and-client-generation`

## Impact

- Server：outputs / research / qa / refine / studio / sources 路由挂载与 alias
- Web：Eden 调用路径
- OpenAPI registerApiDoc 全量路径更新
- E2E @p0 + server 集成测试
