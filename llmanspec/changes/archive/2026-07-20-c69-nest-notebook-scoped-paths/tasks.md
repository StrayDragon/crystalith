## 0. 约束（实施时对照 design）

- Registry 保持扁平：`/outputs/types`、`/qa/presets`、`/refine/modes`、`/sources/parsers`
- 嵌套：`:nid` 为归属 SSOT；body `notebookId` 非必填；若携带且 ≠ `:nid` → 400
- 扁平 alias：仍强制 c67 query/body `notebookId`
- SSE 只改路径，不改动词（c70）

## 1. Shared / server helpers

- [x] 1.1 增加 nested body schema（`omit({ notebookId })` 或等价）与 `resolveNestedNotebookId(nid, bodyNotebookId?)`（mismatch → 400）
- [x] 1.2 确认响应实体仍含 `notebookId`；registry 路由不改路径

验证：相关 shared/server 单测或类型检查片段

## 2. Server — 按域嵌套 + alias

### 2a. sources（补全）

- [x] 2a.1 嵌套：`upload`、`:sid` GET/DELETE、chunks、re-embed（list/tags 等已嵌套则不动）
- [x] 2a.2 扁平 `/sources/upload`、`/sources/:id*` 改为 deprecated alias
- [x] 2a.3 OpenAPI：新路径 canonical；旧路径 deprecated；`/sources/parsers` 保持扁平

### 2b. outputs

- [x] 2b.1 嵌套：`/notebooks/:nid/outputs` CRUD + export 等子路径（**不含** types）
- [x] 2b.2 扁平 `/outputs`（非 types）改为 alias
- [x] 2b.3 OpenAPI 同步；`/outputs/types` 保持扁平

### 2c. research

- [x] 2c.1 嵌套：list/create + `/:id/*`（含 stream）
- [x] 2c.2 扁平改为 alias；OpenAPI + AsyncAPI 地址更新

### 2d. qa

- [x] 2d.1 嵌套：`/qa`、`/qa/stream`、`/qa/export`（**不含** presets）
- [x] 2d.2 扁平改为 alias；OpenAPI + AsyncAPI；`/qa/presets` 保持扁平

### 2e. studio

- [x] 2e.1 嵌套：`/notebooks/:nid/studio/slides*`
- [x] 2e.2 扁平改为 alias；OpenAPI 同步

### 2f. refine

- [x] 2f.1 嵌套：`/refine`、`/refine/batch`（**不含** modes）
- [x] 2f.2 扁平改为 alias；OpenAPI；`/refine/modes` 保持扁平

验证（本节后）：`cd apps/server && bun test`（至少 pagination + 相关域）

## 3. Frontend Eden / stream

- [x] 3.1 `useOutputQueue`、`useSlidesStudioDialog` → nested outputs/slides
- [x] 3.2 `useResearch` + stream URL → nested
- [x] 3.3 `useChat` / QA post + `/qa/stream` → nested
- [x] 3.4 `useSources`：upload / `:id` / re-embed → nested
- [x] 3.5 `evidenceExport` 及其他手写 `/v2/...` URL → nested

验证：相关 web Vitest

## 4. 测试路径假设

- [x] 4.1 server `test/**`：pagination/research 主路径改嵌套；保留扁平 alias 用例；补 omit-body 201 + mismatch 400
- [x] 4.2 web MSW / Vitest 路径更新
- [x] 4.3 e2e @p0 若硬编码路径则更新

验证：`just test` + `just test-web`；必要时 `just e2e`

## 5. 门禁

- [x] 5.1 `llman sdd validate c69-nest-notebook-scoped-paths --strict --no-interactive`
- [x] 5.2 `just qa`
