## 1. Specs（提案）

- [x] 1.1 充实 `proposal.md` / `design.md` / `tasks.md`
- [x] 1.2 delta：`deep-research-runtime`（MUST/SHALL + scenarios）；收窄 `structural-refinement-for-generated-results`
- [x] 1.3 `llman sdd validate c76-deep-research-runtime --strict --no-interactive --stage spec`
- [x] 1.4 产品文档：PRD 附录指向本 change；`runtime-spec` / `ui-proto` 骨架已建，细节后续 grill

## 2. Shared 合约 + DB

- [ ] 2.1 `packages/shared`：ResearchRun / create / list / confirm / convert / report+citation map Zod（desc i18n）
- [ ] 2.2 DB migration：runs + graph/checkpoint（或等价 JSON 列）+ notebook 外键
- [ ] 2.3 路由挂载 Zod；OpenAPI 标签 `research`；去掉 501 stub 文案

验证：`bun typecheck`；schema / openapi 相关单测

## 3. Runtime 核心（后端 full）

- [ ] 3.1 create / list / get（H1′ D1 toggles + desk sourceIds + L1 depth → maxSearches/maxNodes）
- [ ] 3.2 执行循环：tools 编排；共享 `searchWeb`；checkpoint；状态机
- [ ] 3.3 GET SSE（或约定 stream）推送 graph/status patch；取消/abort
- [ ] 3.4 M1 confirm API（预算将尽 / 扩支路）

验证：`apps/server/tests/research/*`（新建）；stub 501 测试改为成功路径

## 4. 报告 + 转化

- [ ] 4.1 `synthesizeReport` → 结构化报告 + 全局 citation map（K1）
- [ ] 4.2 `convertToNote` → PARAGRAPH + GFM `[^n]` 脚注（走现有 outputs 直写路径）
- [ ] 4.3 `convertToSource` → ingest + embed；对话检索可命中验收

验证：转化单测 + 可选轻量 QA retrieve 断言

## 5. FE 占位（不实现交互）

- [ ] 5.1 tasks/注释：E1 深研 Tab 仍可壳；标明依赖后续 ui-proto change
- [ ] 5.2（可选）FE types 仅从 shared 导入 Run DTO，不接 UI

验证：无 e2e 深研强制绿（保持壳不崩）

## 6. 门禁

- [ ] 6.1 `bun typecheck` + `just test`（server/shared）
- [ ] 6.2 `just qa`

验证：`just qa`
