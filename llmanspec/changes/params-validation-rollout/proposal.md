---
depends_on: []
branch: sdd/params-validation-rollout
base_sha: e2294c7793b104e2b03a7e57c24e8a4d4c0e1c72
checkpointed: false
---

## Why

elysia 规范审查发现：全部路由的 path 参数**零 schema 挂载**，11 个 router 共 **97 处**手工
`requirePositiveIntId()` 解析；而 notebooks 的 apiDocs 又为文档层单独维护了 `IdSchema` —— 同一约束双轨维护。
这偏离 root AGENTS.md「body/query/**params**/response 挂载 shared Zod」的项目自身约定。

试点已验证（notebooks 三条 `:nid` 路由，380 tests green）：

- `z.coerce.number().int().positive()` 挂 `{ params }` 工作正常，Eden 推断 params.nid 为 number
- 行为差异：非法 id 从 `400 INVALID_REQUEST` 变为 `422 SCHEMA_VALIDATION_FAILED`

## What Changes

- 决策：采用「**统一验证语义 = 422 + SCHEMA_VALIDATION_FAILED**」（与现有 body 校验行为完全一致，
  见 design D2 事实核查），全仓铺开 params schema 挂载
- 11 个 router 移除 handler 内手工 id 解析（~97 处）；`requirePositiveIntId` 保留给 query 等
  真正需要宽松语义/自定义错误文案的场景
- specs landing：workspace-api-contract 增补一条当前态声明（path/id 校验失败 → 422 统一信封），
  消除与 r244「404/400」（ownership 场景专用）的表述歧义

## BREAKING

wire 可见：bad-id 错误码 INVALID_REQUEST(400) → SCHEMA_VALIDATION_FAILED(422)。
已核实无 spec 钉住校验类错误码；业务状态机错误（AppHttpError）不受影响。
