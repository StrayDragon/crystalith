---
depends_on:
  - c69-nest-notebook-scoped-paths
---

## Why

c69 已将 notebook-scoped 资源迁到 `/v2/notebooks/:nid/...`，并保留扁平路径作 deprecated alias。一等前端（Eden）已全部走嵌套路径；alias 窗口应关闭，避免双轨路由、重复 OpenAPI 登记与测试继续绑定即将删除的路径。

## What Changes

**BREAKING** — 删除以下 25 条扁平 deprecated alias（调用方 MUST 改用嵌套 canonical）：

| Domain  | DELETE (flat)                                                                                             | KEEP / use instead                  |
| ------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| outputs | `POST/GET /v2/outputs`；`GET/DELETE /v2/outputs/:id`；`GET .../export`；`POST .../convert-to-source`（6） | `/v2/notebooks/:nid/outputs…`       |
| qa      | `POST /v2/qa`；`POST /v2/qa/stream`；`GET /v2/qa/export`（3）                                             | `/v2/notebooks/:nid/qa…`            |
| sources | `POST /v2/sources/upload`；`GET/DELETE /v2/sources/:id`；`GET .../chunks`；`POST .../re-embed`（5）       | `/v2/notebooks/:nid/sources…`       |
| studio  | flat `/v2/studio/slides*`（11）                                                                           | `/v2/notebooks/:nid/studio/slides*` |

**KEEP（非 alias）**：`GET /v2/sources/parsers`（进程级 registry，全局扁平）。

同步：

- 删除对应 `registerApiDoc(..., deprecated: true)` 条目
- 清理仅服务 flat alias 的 Zod schema（若无其它引用）
- 测试与 shared schema 用例改走嵌套路径
- Spec：移除「flat = deprecated alias」要求；OpenAPI MUST 仅以嵌套 path 为 notebook-scoped 真源

## Capabilities

- `workspace-api-contract`
- `openapi-and-client-generation`

## Impact

- Server：`features/{outputs,qa,sources,studio}/router.ts`
- Shared：flat-only Zod（`OutputGenerateRequestSchema`、`OutputExportQuerySchema`、`QaRequestSchema` flat 形、`SourceUploadQuerySchema`、`SlideDraftCreateRequestSchema`、`StudioSlidesListQuerySchema`、`NotebookIdQuerySchema` 等——仅在无引用时删除/改测）
- Tests：`notebook-isolation`、`pagination`、`sources/ingest` upload helper、`studio/two-stage`、`packages/shared/test/schemas.test.ts`
- OpenAPI/Scalar：不再出现上述 flat deprecated 操作
- **非目标**：c91；research 路由；全局 registry 外的其它 flat 端点；前端（已 nested-only）
