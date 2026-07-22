## Propose（本阶段）

- [x] 提案 + design：排他父闭包 B、失败汇入、禁 sink
- [x] delta `deep-research-runtime`：r316 + 修改 r310 + scenarios
- [x] delta `deep-research-ui`：r414 + scenario
- [x] `llman sdd validate update-research-prune-cascade --strict --no-interactive`

## Apply（下一阶段 `llman-sdd-apply`）

1. 复核 server `collectResearchPruneClosure` / `pruneNode` 对照 r316
2. 保护节点 prune → `INVALID_REQUEST` 集成断言（若尚未覆盖）
3. 确认 merge 边在 prune 后仍 persist 于 graph JSON
4. Desk `ResearchGraph` 按 r414 弱化 pruned / 失败 merge（与 Lab 对齐）
5. 回归：`bun test apps/server/tests/research/prune-closure.test.ts`
6. 回归：`cd apps/web && bun test src/features/research-lab/fake/deriveLabState.test.ts src/features/research-lab/fake/graphMutations.test.ts`
7. 收尾门禁：`just qa`（或 typecheck + 上述单测）

## 已有样板（无需重做）

- Lab：排他淡化 + 保留汇入 + 结论「部分汇入失败」
- Lab 报告 `[^@nodeId]` 锚点（样板；非本 change MUST）
- `apps/server/tests/research/prune-closure.test.ts`
