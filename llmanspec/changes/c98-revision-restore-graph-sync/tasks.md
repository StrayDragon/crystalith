# Tasks: c98-revision-restore-graph-sync

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r451 + scenarios
- [x] `llman sdd validate c98-revision-restore-graph-sync --strict --no-interactive`

## Apply（`llman-sdd-apply` · 全程 main）

### 1. Restore 后 reload

- 1.1 Eden `restoreRevision` 成功 → `loadRun(notebookId, rid)` 或等价 GET 全量
- 1.2 本地 `run` state 更新 nodes/edges/report 与快照一致
- 1.3 Vitest：restore 触发 GET；nodes 反映服务端响应

### 2. 图页同步

- 2.1 报告页恢复后导航回 graph：画布读取已刷新 run，非 stale slice
- 2.2 Eden 路径 `restoreGraphSlice` 改为 delegate 到 loadRun 或显式 no-op 且文档化；禁止静默跳过
- 2.3 Vitest / 集成：restore 后 graph 节点数/标题与 revision 一致

### 3. 验证

- 3.1 `cd apps/web && bun run test:ci` + `bun typecheck`
- 3.2 `llman sdd validate c98-revision-restore-graph-sync --strict --no-interactive`
