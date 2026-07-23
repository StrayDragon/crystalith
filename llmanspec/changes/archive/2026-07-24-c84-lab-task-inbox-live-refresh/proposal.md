---
depends_on: [c82-wire-lab-eden]
---

## Why

c82 已把任务抽屉接到 `GET …/research`，但浏览器全链路暴露：**创建 / confirm / complete / cancel 后 SWR 不失效**，抽屉与 badge 滞后（例：Run 已 `completed` 仍显示「待确认」与「1 进行中」）。任务 inbox 是产品闭环的可见权威，必须跟 Run 状态同步。

## What Changes

1. **创建后刷新**：Compose `POST` 成功后 `mutate` 任务列表（Lab + 工作区头像旁共用 hook）。
2. **状态事件后刷新**：SSE `status` / `confirm` / `report_ready`、以及 HTTP confirm/cancel/prune/fork 成功后刷新 list。
3. **badge / activeCount**：MUST 以 list 最新 `status` 计算（queued|running|awaiting_confirm）；completed/failed/cancelled MUST NOT 计入进行中。
4. **抽屉打开时**：可 `revalidate`；切换 notebook 清缓存。
5. **回归**：Vitest（mutate 触发）+ 定向手测/e2e：创建 → badge+1；完成 → badge 归零且列表状态正确。

## Capabilities

- `deep-research-ui` — 任务 inbox 与 ResearchRun 状态一致

## Impact

- depends_on `c82-wire-lab-eden`
- 不含报告页 / cancel 文案 / node chat（见 c85–c88）
- 浏览器已证缺口：drawer 仍示「待确认」于 completed Run #10

## Seams

- `useResearchTasks` + SWR key `['research-tasks', notebookId]`
- `useEdenLabController` create/confirm/cancel/stream handlers
- `ResearchTasksTrigger` badge
