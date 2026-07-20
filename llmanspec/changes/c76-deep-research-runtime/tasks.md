## 1. Specs（提案）

- [x] 1.1 proposal / design / tasks
- [x] 1.2 delta `deep-research-runtime` + structural-refinement 收窄
- [x] 1.3 `llman sdd validate c76-deep-research-runtime --strict --no-interactive --stage spec`
- [x] 1.4 PRD 瘦身为 §0 索引；runtime-spec 并入 design.md 并删除；ui-proto 保留待 FE change

## 2. Shared 合约 + DB

- [ ] 2.1 Zod：CreateBody、Run、Status、Node、Edge、EdgeKind、Report、ArtifactRef、ConfirmBody、GraphPatch、Evidence、StreamEvent（desc i18n）
- [ ] 2.2 Migration：research_runs + graph/checkpoint JSON（或表）+ research_evidences（EV1）+ notebook FK
- [ ] 2.3 路由挂载；OpenAPI `research`；删除 501 stub

验证：`bun typecheck`；openapi/schema 相关测

## 3. Runtime 核心

- [ ] 3.1 create/list/get（H1′ + L1 校验）
- [ ] 3.2 执行循环：tools、`searchWeb`、EV1 evidence、CP1 checkpoint、R2a 状态机
- [ ] 3.3 GET SSE R3b + D1 graph_patch；A1 cancel
- [ ] 3.4 M1 confirm；U2 prune/fork

验证：`apps/server/tests/research/*`

## 4. 报告 + 转化

- [ ] 4.1 synthesizeReport → R6a
- [ ] 4.2 convertToNote → PARAGRAPH + GFM footnotes
- [ ] 4.3 convertToSource → ingest+embed；对话可命中

验证：转化单测 + retrieve 断言

## 5. FE 占位

- [ ] 5.1 深研 Tab 保持壳；注释指向 ui-proto / 后续 FE change
- [ ] 5.2（可选）仅导出 shared 类型给 web，不接 UI

验证：壳不崩；无强制深研 e2e

## 6. 门禁

- [ ] 6.1 `bun typecheck` + `just test`
- [ ] 6.2 `just qa`

验证：`just qa`
