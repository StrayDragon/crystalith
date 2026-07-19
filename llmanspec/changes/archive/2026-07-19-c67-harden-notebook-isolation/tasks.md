## 1. Shared schemas + server ownership checks

- [x] 1.1 `packages/shared`：为 sources/outputs/research/studio/tasks 相关 query 将 `notebookId` 标为必填（或等价 path 参数）
- [x] 1.2 `sources`：`GET/DELETE /v2/sources/:id`、`:id/chunks`、`POST :id/re-embed` 强制 notebook 归属；跨本 → 404
- [x] 1.3 `outputs`：`GET/DELETE /v2/outputs/:id`、`:id/export`、`POST :id/convert-to-source` 强制 notebook 归属
- [x] 1.4 `research`：`GET /v2/research` 必填 `notebookId`（禁止全表）；`:id` 及 control/stream/export 校验归属
- [x] 1.5 `studio` slides 单资源 GET/PATCH/stream：校验 `slide.notebookId`
- [x] 1.6 `tasks` / `citations`：单资源读取增加 notebook（或 session→notebook）归属校验
- [x] 1.7 错误语义：session 乐观锁 → `409 CONFLICT`；research/sources 状态机非法 → `AppHttpError`（非裸 `Error` / 非伪 404）

验证：`cd apps/server && bun test`（新增跨 notebook 用例须覆盖 sources/outputs/research）

## 2. Frontend 同批传参

- [x] 2.1 `useOutputQueue`：get/delete 传 `notebookId`
- [x] 2.2 `evidenceExport`：export URL 写入 `notebookId` query
- [x] 2.3 `useResearch` / `useSlidesStudioDialog`：单资源调用携带 notebook 范围
- [x] 2.4 相关 web 单测更新

验证：`cd apps/web && bun run test:ci -- src/features/workspace/shared/hooks/useOutputQueue.test.tsx src/features/workspace/domains/research`

## 3. 门禁

- [x] 3.1 `llman sdd validate c67-harden-notebook-isolation --strict --no-interactive`
- [x] 3.2 `just qa`（或至少 `bun typecheck` + server/web 相关测试 + e2e @p0）
