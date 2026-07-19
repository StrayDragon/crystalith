## 1. Shared + server pagination

- [x] 1.1 确认/补齐 `PaginatedSchema` 导出与 OpenAPI 友好描述（`packages/shared`）
- [x] 1.2 `GET .../messages`：响应改为 `PaginatedSchema(MessageSchema)`，返回真实 `total`
- [x] 1.3 `GET .../sessions`：采用 `PaginationParamsSchema` + `PaginatedSchema` + `total`
- [x] 1.4 `GET .../sources`、`GET /v2/outputs`、`GET /v2/research`、`GET /v2/studio/slides`、`GET .../tasks`：加分页 query + Paginated 响应（DB 或内存 slice 均可，但契约必须一致）

验证：`cd apps/server && bun test`（含列表分页断言）

## 2. OpenAPI / AsyncAPI 对齐

- [x] 2.1 修正 citations `registerApiDoc` 路径为 `/v2/notebooks/:nid/citations/context`
- [x] 2.2 修正 `asyncapi.ts` research stream address 与实现一致
- [x] 2.3 为 1.x 列表端点同步 `registerApiDoc` 的 request/response 形状
- [x] 2.4 抽样核对 Scalar/`/openapi` 或路由挂载 schema（若生成管线炸，记录 follow-up，不阻塞以路由 Zod 为准）

验证：`rg` 漂移路径清零；相关 server 测试绿

## 3. Frontend 适配

- [x] 3.1 更新消费列表的 hooks：messages / sessions / sources / outputs / research / slides（读 `items`/`total`）
- [x] 3.2 更新相关 Vitest / MSW fixtures

验证：`cd apps/web && bun run test:ci`（至少相关文件）

## 4. 门禁

- [x] 4.1 `llman sdd validate c68-align-openapi-and-pagination --strict --no-interactive`
- [x] 4.2 `just qa`
