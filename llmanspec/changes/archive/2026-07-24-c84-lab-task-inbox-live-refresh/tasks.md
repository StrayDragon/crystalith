# Tasks: c84-lab-task-inbox-live-refresh

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r425 + scenarios
- [x] `llman sdd validate c84-lab-task-inbox-live-refresh --strict --no-interactive --stage spec`

## Apply（`llman-sdd-apply`）

### 1. 暴露 refresh 并接线 mutate 触发点

- [x] 1.1 `useResearchTasks`：导出稳定 `refresh`（SWR `mutate`）；切换 `notebookId` 时清旧 key 缓存
- [x] 1.2 Compose 创建成功（`useEdenLabController` / 共用 create 路径）后 `refresh` 任务列表
- [x] 1.3 HTTP 命令成功：confirm / cancel / prune / fork 后 `refresh`
- [x] 1.4 SSE handler：`status` / `confirm` / `report_ready` 到达后 `refresh`（可与当前 run 局部态并存）

### 2. badge / activeCount 与抽屉展示

- [x] 2.1 `ResearchTasksTrigger` 与 `ResearchTasksDrawer` 共用 `useResearchTasks`；`activeCount` 仅计 queued|running|awaiting_confirm
- [x] 2.2 抽屉打开时 MAY `revalidate`（`mutate` 或 SWR `revalidateOnMount`）；列表行 status 与 `GET …/research` 一致

### 3. 验证

- [x] 3.1 Vitest：`useResearchTasks` / controller 或 trigger — mutate 在 create 与 SSE/命令回调后被调用；activeCount 过滤终态
- [x] 3.2 （可选）定向 e2e：创建 → badge +1；confirm/完成 → badge 归零且抽屉状态正确
- [x] 3.3 `cd apps/web && bun run test:ci`（或相关用例子集）+ `bun typecheck`
- [x] 3.4 `llman sdd validate c84-lab-task-inbox-live-refresh --strict --no-interactive`
