## 0. Spec / design

- [x] 0.1 充实 proposal（BREAKING inventory）+ design + tasks
- [x] 0.2 Delta：`workspace-api-contract` — remove `flat-notebook-scoped-paths-are-deprecated-aliases`；必要时 modify `nested-path-nid-is-ownership-ssot` / 相关 scenario（qa-export、error-envelope 文案改嵌套）
- [x] 0.3 Delta：`openapi-and-client-generation` — modify `openapi-documents-nested-canonical-paths`（扁平 alias 不得再登记）
- [x] 0.4 `llman sdd validate c90-remove-flat-deprecated-notebook-aliases --stage spec --strict --no-interactive`

## 1. Server — delete flat handlers + docs

- [x] 1.1 `outputs/router.ts`：删 6 条 flat handlers + deprecated `registerApiDoc`
- [x] 1.2 `qa/router.ts`：删 3 条 flat handlers + docs
- [x] 1.3 `sources/router.ts`：删 5 条 flat handlers + docs；**保留** `GET /v2/sources/parsers`
- [x] 1.4 `studio/router.ts`：删 11 条 flat `/v2/studio/slides*` handlers + docs

验证：`rg "deprecated: true|/v2/outputs'|/v2/qa'|/v2/studio/slides" apps/server/src/features` 无 flat alias 残留（parsers 除外）

## 2. Shared schemas + tests

- [x] 2.1 删除仅 flat 使用的 Zod（或改注释）；更新 `packages/shared/test/schemas.test.ts`（QA 改 nested）
- [x] 2.2 `notebook-isolation.test.ts`：改嵌套 path 断言归属/404
- [x] 2.3 `pagination.test.ts`：去掉 flat outputs alias 用例（或改嵌套）
- [x] 2.4 `sources/ingest.test.ts` upload helper → nested upload
- [x] 2.5 `studio/two-stage.test.ts` → nested slides paths
- [x] 2.6 AGENTS.md：若仍有「flat deprecated alias」bullet 则更新/删除

验证：`just test`；`bun typecheck`

## 3. Gate + archive

- [x] 3.1 勾选全部 tasks；`llman sdd validate c90-… --strict --no-interactive`
- [x] 3.2 Verify（无 CRITICAL）
- [x] 3.3 `llman sdd change archive c90-remove-flat-deprecated-notebook-aliases`
- [x] 3.4 Commit：`feat(server): remove flat deprecated notebook-scoped aliases (c90)`
