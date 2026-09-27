---
depends_on: ["c114-deep-research-a-class-scenarios"]
---

# workspace-api-contract B 类 18 条：新增 server 集成测试 + 补场景

## Why

B 区（裸规则需新增测试资产）第一区选 workspace-api-contract：18 条 B 类全部是 server 侧 HTTP 合约行为（鉴权、health 豁免、UI state 端点、presets CRUD、导出、tools 元数据、models envelope、convert 过滤、registry 路径、scoped 列表 400），不需要前端组件测试基建，用既有 setupIntegrationEnv 集成测试面即可闭环，且测试进入 `just qa` 门禁获得持续守护。

## What Changes

- 新增 server 集成测试（apps/server/tests/，走 setupIntegrationEnv，hermetic——不依赖 live key），覆盖 18 条 B 类规则的可程序判定行为；行为确实无法 hermetic 验证的条款保持裸规则并记录（宁缺勿滥）。
- 对应 18 条规则在 spec 内补嵌套 `场景:`，锚定新测试文件。
- 不改任何路由/业务代码；若测试暴露真实缺陷，停在此处报告而非顺手改产品行为。

## Capabilities

- `specs/workspace-api-contract`

## Impact

- review `pending` 209 → 约 191（以实际可 hermetic 验证的条款数为准）。
- `just qa` 的 server 测试面新增一个文件（逐文件隔离纪律：自包含 setup/teardown）。
