---
depends_on: ['c112-dedupe-colliding-req-ids']
branch: sdd/c113-add-a-class-scenarios
base_branch: main
base_sha: 58e4cb77dee44ec5c4e7042bee505245a705fcb0
---

# A 类裸规则全量补场景（非深研 33 capability）

## Why

作战地图（docs/specs-bare-rule-campaign.md）盘点出 448 条裸规则，其中 A 类（行为可程序判定且既有测试资产已覆盖或极贴近）242 条。非深研 33 个 capability 的 A 类约 120 条可只补场景、零新增测试面——是压降性价比最高的一批，先于 B 类（需新增测试）与深研双雄大批次执行。碰撞句柄已由 c112 清零，`@req` 锚定可信。

## What Changes

- 33 个非深研 capability 的全部 A 类裸规则补嵌套 `场景:`（结构化 GWT，锚定既有测试资产，house style 同 c111：web-ui-foundation r341/r342 与 c111 新增 13 条范式）；每规则默认 1 个场景，规则含两个明确分支行为时至多 2 个。
- B 类（需新增测试）与 C 类（合法裸规则）保持原样；B/C 逐条理由由分片报告产出，汇入作战地图 C 类豁免台账与 B 区批次依据。
- 规则描述文本零改动；不新增任何测试代码（A 类定义即锚定既有测试）。

## Capabilities

workspace-api-contract、source-ingestion-upload-and-url、source-ingestion-core、source-connectors、source-ingestion-management-and-tags、source-ingestion-summary-and-conversion、openapi-and-client-generation、data-and-storage、retrieval-and-cache、web-extractor-plugins、frontend-eden-migration、output-rendering-and-typing、chat-prompt-presets、architecture-core、architecture-plugin-and-agent、generation-core、workspace-ui-core、studio-slides-workflow、workspace-ui-panels、studio-output-types、generation-presets-and-constraints、quality-and-regression、generation-observability-and-guardrails、typed-generation-framework（以分片实际落点为准）。

## Impact

- review `pending` 预期 448 → 约 330（A 类清零后仅剩深研 A 121 + B 159 + C 47）。
- 结构门与碰撞自检必须保持全绿；`spec next-req-id` 应维持 r474（不新增规则，只加场景）。
