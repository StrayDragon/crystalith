---
depends_on: []
---

# 移除无代码对应的 spec 块（cross-type 与 source-aware 两 capability）

## Why

全仓 spec 对应性核查（裸规则作战 c121 前置调研）确立原则：**spec 是行为合约，应与代码对应；无代码对应的 MUST 条款按「实现 or 移除」逐块分析，不做无限期挂账**。两块 capability 经代码核验为零实现愿景块：

- `source-aware-generation-modes`（7 条 r239-r244/r419）：生成类型声明来源使用模式（strict_evidence/brainstorming）——server/shared/web 全部 grep 零命中（`qa/presets.ts` 的 "brainstorming" 仅为提示词文案）。
- `cross-type-result-transformations`（7 条 r39-r45）：结果间转换/lineage——`lineage|transformation` 零命中（c117 的 conversion-lineage 测试覆盖的是 output→source 转换，归 `source-ingestion-summary-and-conversion`，不同语义）。

保留它们会持续产生虚假的 pending 信号并误导实现排序。

## What Changes

- **删除 capability `source-aware-generation-modes` 整目录**（7 条全零代码，含 C 台账 r241/r244 两条豁免项随之注销）。
- **删除 capability `cross-type-result-transformations` 整目录**，其中两条有代码对应者区别处置：
  - r44（GET single session）：已实现（`sessions/router.ts:153`，c39 parity）且已被 `workspace-api-contract` r349「Notebook/session/message endpoints are stable」覆盖 → 按 specs-compact 冗余合并原则移除；
  - r45（convert-to-output 收集 citations chunkIds）：已实现（`sessions/convert.ts:48-59,221`）但**无测试断言** → 迁移至 `workspace-api-contract`（convert 合约群 r365/r366 旁），补嵌套场景 + 补 `qa-session-contract` 集成断言（A 类收敛）。
- 净效果：pending 108 → 94（−13 删除，−1 r45 场景化），capability 35 → 33。

## Impact

- 破坏性合约变更（移除条款）：无外部 client 消费这些 MUST（均零实现），无迁移路径需要；`migrations/` 不适用。
- 豁免台账（`docs/specs-bare-rule-campaign.md`）C 类 46 → 44（注销 r241/r244）。
- 行为面无变化：删除的条款本就无对应实现，r45 迁移不改变语义。
