# Design: c86 Lab cancel + Compose Eden copy

## Scope

在 c82 Eden 接线基础上，补齐 **协作 cancel UX**、**顶栏主操作语义** 与 **Compose 模式文案**。无新 API；复用既有 `POST …/cancel` 与 c84 inbox refresh。

## Cancel 流

```
用户点「取消研究」（顶栏或抽屉）
    → useEdenLabController.cancel()
        → edenResearchApi.cancelResearchRun(notebookId, runId)
        → POST …/research/:rid/cancel
    → 成功：本地 phase/status → cancelled；stopStream
    → useResearchTasks.refresh()（c84 r425）
    → SSE status 终态（若晚到）仍 refresh，不覆盖 cancelled 回退
```

暴露 cancel 的 Run status：`queued` | `running` | `awaiting_confirm`。`completed` / `failed` / `cancelled` MUST NOT 再示取消。

## Primary action 映射（Eden）

| Run / Lab phase             | 顶栏主操作           | 次操作   | 行为                                    |
| --------------------------- | -------------------- | -------- | --------------------------------------- |
| queued / running（playing） | 取消研究             | —        | `cancel()`，非 `pause()` no-op          |
| awaiting_confirm            | 生成结论             | 继续深挖 | 保持既有 `finishReport` / `continueDig` |
| cancelled                   | 重新研究 或 状态说明 | —        | 沿用 completed/failed 终态模式          |

`resolveLabPrimaryAction` 可保留 fixture 的 pause/resume；Eden 路径在 `ResearchLabPage` 或 controller 层覆盖 `kind: 'pause'` → cancel，避免破坏 fixture 回放。

## Compose 文案（mode）

| `mode`    | 标题区说明                                    | 底部 hint              | 示例主题按钮                   |
| --------- | --------------------------------------------- | ---------------------- | ------------------------------ |
| `eden`    | 创建真实 ResearchRun；不提 fixture / 演示回放 | 创建后进入研究图与 SSE | 中性文案（如「填入示例主题」） |
| `fixture` | MAY 保留 xlsx-lib 演示回放说明                | MAY 保留 fixture hint  | MAY 保留「xlsx 选型」          |

`LabComposePanel` 新增 `mode: 'eden' | 'fixture'`（或等效 prop）；`ResearchLabPage` 按 `LabWorkbench.mode` 传入。

## Seams

| 组件 / hook                         | 职责                                               |
| ----------------------------------- | -------------------------------------------------- |
| `useEdenLabController`              | 实现 `cancel`；queued/running 主操作不走空 `pause` |
| `edenResearchApi.cancelResearchRun` | 已有 POST cancel                                   |
| `resolveLabPrimaryAction`           | fixture pause/resume；Eden 覆盖层                  |
| `ResearchLabPage.runPrimary`        | 路由 `pause` → cancel（eden）                      |
| `LabComposePanel`                   | mode 分支文案 + example label                      |
| `ResearchTasksDrawer`               | MAY 行内取消（queued/running/awaiting_confirm）    |
| `useResearchTasks.refresh`          | cancel 成功后失效（c84）                           |

## 与邻接 change 边界

- **c84（r425）**：cancel 成功后 MUST 触发 inbox refresh；本变更不重复定义 mutate 触发点全集
- **c85**：不含报告页
- **c87–c89**：不含 node evidence / chat / revisions

## Guardrails

- MUST NOT 在 Eden 默认路径宣称 xlsx-lib fixture 为权威（对齐 r424）
- MUST NOT 第二套 cancel API 或平行 wire DTO
- fixture 模式（`VITE_LAB_FIXTURE=1`）行为 MAY 保持演示 pause，不在本变更削弱

## Testing

- Vitest：`resolveLabPrimaryAction` / Eden 覆盖；`LabComposePanel` eden vs fixture 文案快照
- Vitest：`useEdenLabController.cancel` mock API + `refresh` 被调用
- 定向手测：running → 取消 → inbox 示 cancelled、badge 更新
