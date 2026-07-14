# c63 Tasks

## P0: sources notebook_id query（安全/正确性）

- [x] 1.1 `useSources.ts`: `removeSource`（:492）`.delete({ query: { notebook_id: activeNotebookId } })`
- [x] 1.2 `useSources.ts`: `handleReembedSource`（:846）`.post(null, { query: { notebook_id: activeNotebookId } })`（验证 eden POST+query 语法）
- [x] 1.3 `SourceDetailDialog.tsx`: `fetchSourceChunks` 签名加 `notebookId`,调用加 `{ query: { notebook_id: notebookId } }`
- [x] 1.4 验证 3 处调用点 `notebookId` 在闭包可用（useWorkspaceStore activeNotebookId）

## P1: ErrorEnvelope 统一解析

- [x] 2.1 新建 `apps/web/src/api/parseServerError.ts`: `parseServerError(error)` 返回 `{ errorCode?, message, details?, status? }`
- [x] 2.2 `useSources.ts`: `:268-274` inline cast 改 `parseServerError`
- [x] 2.3 `useSources.ts`: `:729-737` inline cast 改 `parseServerError`

## P1: 类型清理

- [x] 3.1 `api/shared-types.ts`: 删除陈旧 `ExtractorInfoResponse`（:67-74）
- [x] 3.2 确认无其他引用（grep 验证）

## 验证

- [x] 4.1 `cd apps/web && bun run typecheck` 通过（或至少不新增 error）
- [x] 4.2 手动验证: 跨 notebook 访问 source 被 404（需 bun dev 联调）——已用本地 bun server 实测：GET /sources/:id?notebook_id=B→404、?notebook_id=A→200、无 notebook_id→200（校验被跳过，印证前端必须传参）；chunks 路由同理
- [x] 4.3 `llman sdd validate c63-adapt-frontend-v2-contracts` 通过

## 后置（future,不在本 change）

- studio config_schema 消费组件（替换硬编码 SlideGenerationConfig）——后置项，见 `future.md`，不在本 change 范围
