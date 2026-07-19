## 决策

1. **嵌套优先、扁平为 alias**：新 canonical = `/v2/notebooks/:nid/...`；旧扁平在同一 PR 仍可用但文档标 deprecated。
2. **c67 归属校验保留**：嵌套 path 的 `:nid` 即 notebook 边界；alias 仍强制 query/body `notebookId` 与资源一致。
3. **保持全局扁平（CRUD / 运维）**：`/v2/notebooks`、`/v2/models`、`/v2/commands`、`/v2/prompt-presets`、`/v2/templates`、`/v2/eval/*`、`/v2/strategies`。
4. **保持全局扁平（进程 registry，不嵌套）** — 2026-07-20 钉死：
   - `GET /v2/outputs/types`
   - `GET /v2/qa/presets`
   - `GET /v2/refine/modes`
   - `GET /v2/sources/parsers`
   - MUST NOT 镜像为 `/v2/notebooks/:nid/.../types|presets|modes|parsers`。
5. **归属 SSOT（body/query `notebookId`）** — 2026-07-20 钉死（对齐 sessions）：
   - **嵌套 canonical**：`:nid` 为唯一归属来源；请求 body **不再必填** `notebookId`。
   - **兼容**：若 body 仍携带 `notebookId`：等于 `:nid` → 忽略；**不等于** → **400**。
   - **扁平 alias**：继续强制 `?notebookId=` / body（c67 语义不变）。
   - **响应实体**：继续包含 `notebookId` 字段（资源形状不变）。
   - **Zod**：嵌套 body schema 无必填 `notebookId`；alias 沿用现有必填 schema（或拆 `*Body` + path 注入）。
6. **同域导出**：`qa/export` 嵌套为 `/v2/notebooks/:nid/qa/export`（与 QA 同域）；扁平 export 作 alias。
7. **SSE**：仅改路径嵌套（如 `/v2/notebooks/:nid/qa/stream`、`.../research/:id/stream`）；动词统一留给 c70。

## old → new（摘要）

| 旧                                            | 新                                                      |
| --------------------------------------------- | ------------------------------------------------------- |
| `/v2/outputs`（CRUD，不含 types）             | `/v2/notebooks/:nid/outputs`                            |
| `/v2/outputs/:id`（及 export 等子路径）       | `/v2/notebooks/:nid/outputs/:id`                        |
| `/v2/research`                                | `/v2/notebooks/:nid/research`                           |
| `/v2/research/:id/*`                          | `/v2/notebooks/:nid/research/:id/*`                     |
| `/v2/qa` `/v2/qa/stream` `/v2/qa/export`      | `/v2/notebooks/:nid/qa` `.../qa/stream` `.../qa/export` |
| `/v2/refine` `/v2/refine/batch`（不含 modes） | `/v2/notebooks/:nid/refine*`                            |
| `/v2/studio/slides*`                          | `/v2/notebooks/:nid/studio/slides*`                     |
| `/v2/sources/:id`（及 chunks / re-embed）     | `/v2/notebooks/:nid/sources/:sid`                       |
| `/v2/sources/upload`                          | `/v2/notebooks/:nid/sources/upload`                     |

**不迁移（保持扁平）**：`/v2/outputs/types`、`/v2/qa/presets`、`/v2/refine/modes`、`/v2/sources/parsers`，以及决策 #3 所列全局资源。

## 非目标

- SSE 动词统一（c70）
- Auth（c13）
- 分页形状（c68）
- list outputs 瘦身 / 懒加载全文（c72）
