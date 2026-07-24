# Design: c84 Lab task inbox live refresh

## Scope

在 c82 Eden 接线基础上，补齐 **任务 inbox SWR 失效** 与 **badge 计数** 与 ResearchRun 状态同步。无新 API；不改 Desk r402 轮询策略。

## Refresh 触发图

```
useResearchTasks (SWR ['research-tasks', notebookId])
    ↑ refresh / mutate
    ├── Compose POST create 成功
    ├── HTTP confirm / cancel / prune / fork 成功
    ├── SSE status | confirm | report_ready
    └── （可选）抽屉打开 revalidate
```

`activeCount` = `tasks.filter(queued|running|awaiting_confirm)`；与 list 同源，不单独维护计数 SSOT。

## Seams

| 组件 / hook            | 职责                                              |
| ---------------------- | ------------------------------------------------- |
| `useResearchTasks`     | SWR fetch + `refresh()` 导出；notebook 切换清 key |
| `useEdenLabController` | create / confirm / stream handlers 调用 `refresh` |
| `ResearchTasksTrigger` | 读 `activeCount`                                  |
| `ResearchTasksDrawer`  | 读 `tasks`；打开时 MAY revalidate                 |

## 与 r402 边界

- **Desk**（r402）：打开时拉取 + 非终态轮询
- **Lab inbox**（r425）：事件驱动 mutate；不引入 notebook 级 list SSE

## Guardrails

- MUST NOT 第二套任务列表状态（demo/fixture 路径保持既有行为）
- MUST NOT 修改 c85–c89 范围（报告页 / cancel 文案 / node chat 等）

## Testing

- Vitest：mock SWR / port，断言 mutate 在列出的触发后被调用
- 可选 e2e：创建 → badge +1；完成 → badge 归零
