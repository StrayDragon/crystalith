## 决策

1. **硬删、不留 410 兼容层**：扁平 alias 直接从 Elysia 挂载与 `registerApiDoc` 移除；客户端命中旧 path 得到框架默认 404（无专用 410 合同）。
2. **嵌套为唯一 notebook-scoped HTTP 面**：`:nid` 归属 SSOT（c69）不变；不再存在「query/body `notebookId` 必填」的 flat 平行面。
3. **Registry 例外不变**：`GET /v2/sources/parsers` 保持全局扁平；其它进程级/全局端点（notebooks 列表、models、commands 等）不在本 change 范围。
4. **Schema 清理边界**：仅删除「只被 flat handlers / flat OpenAPI 引用」的 Zod；嵌套 schema、实体响应 schema、以及仍被测试/其它域引用者保留。若 `QaRequestSchema`（必填 notebookId）被删，测试改断言 `QaNestedRequestSchema`。
5. **文档合同**：`openapi-documents-nested-canonical-paths` 改为「MUST 文档化嵌套 path；MUST NOT 再登记已删除的 flat notebook-scoped alias」。

## old → gone（BREAKING）

| Flat (deleted)                                                         | Nested canonical                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `POST/GET /v2/outputs`                                                 | `POST/GET /v2/notebooks/:nid/outputs`                   |
| `GET/DELETE /v2/outputs/:id`                                           | `GET/DELETE /v2/notebooks/:nid/outputs/:id`             |
| `GET /v2/outputs/:id/export`                                           | `GET /v2/notebooks/:nid/outputs/:id/export`             |
| `POST /v2/outputs/:id/convert-to-source`                               | `POST /v2/notebooks/:nid/outputs/:id/convert-to-source` |
| `POST /v2/qa` / `POST /v2/qa/stream` / `GET /v2/qa/export`             | `/v2/notebooks/:nid/qa{,/stream,/export}`               |
| `POST /v2/sources/upload`                                              | `POST /v2/notebooks/:nid/sources/upload`                |
| `GET/DELETE /v2/sources/:id` (+ chunks / re-embed)                     | `/v2/notebooks/:nid/sources/:sid…`                      |
| `/v2/studio/slides*`（list/create/latest/id/outline/markdown/streams） | `/v2/notebooks/:nid/studio/slides*`                     |

## Rollback

Git revert 本 change；或从 c69 归档恢复 flat handler 块。无数据迁移。

## 非目标

- c91 Lab / toast / evidence
- Research HTTP（若仍有 stub/其它 flat，不在本批 25 条内）
- 为旧 path 增加永久 redirect / 410 信封
