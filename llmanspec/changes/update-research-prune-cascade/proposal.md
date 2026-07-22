---
depends_on: []
---

## Why

c76 `pruneNode` 沿**全部出边 DFS** 级联，会沿 `merge` 误伤结论 sink，也会把仍有活父的共享下游一并剪掉。Lab 原型已收敛为产品规则 **B（排他父闭包）+ 失败汇入保留**；需把该语义升格为 Runtime/UI MUST，避免正式接线时与 demo 分叉。

## What Changes

1. **Runtime（`deep-research-runtime`）**
   - 新增 **r316**：排他父剪枝闭包；禁保护节点；不沿 merge 级联；保留失败 merge。
   - 修改 **r310**：剪枝 MUST 遵循 r316。
2. **UI（`deep-research-ui`）**
   - 新增 **r414**：pruned 弱化、失败 merge 保留可视、结论提示「部分汇入失败」。
3. **实现对齐**（tasks）：server `collectResearchPruneClosure` 门禁化；Lab 已作行为样板；Desk `ResearchGraph` 按 r414 收敛。

## Capabilities

- `deep-research-runtime` — r310 修改 + r316
- `deep-research-ui` — r414

## Impact

- **行为变更**：相对 c76 初版 DFS 剪枝更保守（共享子不误伤；结论永不被级联剪掉）。
- API 形状不变（仍 `POST …/nodes/:id/prune`）；错误：保护节点 → `INVALID_REQUEST`（或等价 400）。
- 无 DB schema 变更；`just qa` / 既有 research 单测扩展。
