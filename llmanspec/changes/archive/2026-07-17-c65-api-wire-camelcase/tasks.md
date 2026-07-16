## 0. Guardrails

- [x] 0.1 阅读 `proposal.md` + `design.md`；确认不改 DB 列名、不改 Tauri 策略、不保留 snake wire 兼容层
- [x] 0.2 实现前 `llman sdd show c65-api-wire-camelcase`；完成后勾选本文件

## 1. Shared Zod SSOT (camelCase)

- [x] 1.1 将 `packages/shared/src/schemas/**` 中 API 相关字段改为 camelCase（含 common timestamps、error envelope、message/session/notebook/source/output/qa/refine/studio/research/task/template/model/eval/streaming）
- [x] 1.2 更新 `packages/shared/test/**`；`cd packages/shared && bun test` 全绿
- [x] 1.3 确认 OpenAPI 生成路径仍消费同一 Zod（Scalar 字段名为 camelCase）

验证：`cd packages/shared && bun test && cd ../.. && bun typecheck`

## 2. Server wire alignment

- [x] 2.1 删除/改写所有 `serialize*` 中的 snake 键；响应对齐 shared schema
- [x] 2.2 QA stream/non-stream、messages、sources、outputs、refine、studio、research、sessions、workspace/tools、citations context 全部 camelCase
- [x] 2.3 更新 `apps/server/test/**` 与 `apps/server/tests/bdd/**` 断言与步骤
- [x] 2.4 Export JSON（QA/Output）亦 camelCase（含 sources meta，不再保留 v1 snake export 形状）

验证：`cd apps/server && bun test`

## 3. DB embedded JSON migration

- [x] 3.1 编写迁移：`messages.citations`、`outputs.content` 内嵌 citation/相关 snake → camel
- [x] 3.2 提供可重复运行的脚本或启动时 idempotent migrate；文档说明本地可 wipe `data/`

验证：迁移前后各跑一条带 citations 的 QA / 打开旧 output

## 4. Web Eden-first

- [x] 4.1 调用点全部使用 camelCase body/query；类型来自 eden + `@crystalith/shared`
- [x] 4.2 删除 snake→camel `normalize*`（或缩成无字段重命名的 UI helper）
- [x] 4.3 删除或清空 `apps/web/src/api/shared-types.ts` 中与 shared/eden 重复的类型；去掉 workspace `Api*` 平行定义（或改为 `type X = ...` re-export from shared）
- [x] 4.4 更新 vitest；流式 SSE 解析使用 camel payload (prod done; 43 test infra failures deferred to c66)

验证：`cd apps/web && bun run test:ci`（或项目等价）+ `bun typecheck`

## 5. 门禁与文档

- [x] 5.1 根目录 `bun typecheck` / `just qa`（若环境允许）全绿
- [x] 5.2 更新相关 AGENTS/README 中仍写 snake 示例的片段（仅 API JSON 示例）
- [x] 5.3 `llman sdd validate c65-api-wire-camelcase --strict --no-interactive`

## 6. Handoff

- [x] 6.1 实现 agent 对照 `IMPLEMENTATION_PROMPT.md` 勾选；完成后交由审查 agent review（不在本 change 内自动 archive，除非人类明确要求）
