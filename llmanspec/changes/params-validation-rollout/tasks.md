# Tasks — params-validation-rollout

前置：本 change 为「决策已定、待实施」提案。D2 已采纳 Option A（422 统一）。
实施前需人工确认 BREAKING（bad-id 错误码变化）可接受。

## Batch 1 — specs landing

- [ ] workspace-api-contract 增补 requirement：path/query 参数格式非法 → 统一 ErrorEnvelope
      （422 SCHEMA_VALIDATION_FAILED）；ownership 404 语义不变（与 r244 划界）
- [ ] `llman sdd validate --specs --strict --no-interactive` 全绿

## Batch 2 — 铺开（按手工调用数降序，每步全量测试）

- [ ] sources（25 处）
- [ ] studio（19 处）
- [ ] sessions（12 处）/ source-connectors（12 处）
- [ ] outputs（10 处）
- [ ] research（4）/ messages（4）/ notebooks 剩余路由（3，试点已覆盖 :nid 三条）
- [ ] qa（3）/ templates（3）/ prompt-presets（2）

## Batch 3 — 收尾

- [ ] shared/ids.ts 注释更新：标注 helper 现役范围（query/业务入口），不再用于已挂 schema 的 path 参数
- [ ] `bun test` / `just test-web` / typecheck / lint 全绿
- [ ] OpenAPI 抽查：path parameters 文档由 handler schema 自然产出后，核对 registerApiDoc 输出无回归
