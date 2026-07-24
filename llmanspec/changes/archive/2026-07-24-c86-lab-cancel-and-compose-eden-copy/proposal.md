---
depends_on: [c82-wire-lab-eden]
---

## Why

1. **Cancel 缺口**：Eden 路径下顶栏「暂停」仍走 fixture `pause()` 语义（`useEdenLabController.pause` 为空操作），与 ResearchRun 协作 cancel 不对齐；用户无法在 running / queued / awaiting_confirm 时终止任务。
2. **Compose 误导**：`LabComposePanel` 默认文案仍写「演示回放 / xlsx fixture / 接线后…」，在已接 Eden 的生产路径上误导用户与评审，违反 r424「fixture 非权威」。
3. **示例主题**：「填入示例主题（xlsx 选型）」在 Eden 模式暴露 fixture 专属措辞。

## What Changes

1. **Cancel**：status 为 running、queued 或 awaiting_confirm 时暴露取消（顶栏和/或任务抽屉）；调用 `POST …/research/:rid/cancel`；成功后按 r425（c84）refresh 任务 inbox。
2. **Primary action**：Eden 下 queued / running 主操作映射协作 cancel（非 fixture pause）；awaiting_confirm 保持「生成结论 / 继续深挖」。
3. **Compose 文案**：`LabComposePanel` 按 `mode`（eden | fixture）切换说明与 hint；Eden MUST NOT 将 xlsx fixture 表述为权威或默认路径。
4. **示例主题**：Eden 使用中性示例文案或隐藏 fixture 专属按钮标签；fixture 路径可保留 xlsx-lib 示例。
5. **质量**：取消后 status=cancelled；Compose 文案 Vitest / 快照覆盖 eden | fixture 分支。

## Capabilities

- `deep-research-ui` — cancel UX + Compose 模式文案

## Impact

- depends_on `c82-wire-lab-eden`
- **建议**在 c84（任务 inbox live refresh）之后或同波实施，以便 cancel 成功后 inbox 立即反映 `cancelled`
- 不含报告页（c85）、node evidence（c87）、node chat（c88）、revisions（c89）
- 浏览器已证缺口：Eden running 点顶栏「暂停」无 cancel 效果；Compose 仍示 fixture 回放文案

## Seams

- `useEdenLabController.pause` / `cancel` + `edenResearchApi.cancelResearchRun`
- `resolveLabPrimaryAction` + `ResearchLabPage.runPrimary`
- `LabComposePanel` copy props（`mode`、example topic label）
- `ResearchTasksDrawer` 取消行操作（可选）
- `useResearchTasks.refresh`（c84）
