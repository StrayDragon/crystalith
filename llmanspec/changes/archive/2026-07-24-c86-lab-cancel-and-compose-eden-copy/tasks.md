# Tasks: c86-lab-cancel-and-compose-eden-copy

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r426–r429 + scenarios
- [x] `llman sdd validate c86-lab-cancel-and-compose-eden-copy --strict --no-interactive --stage spec`

## Apply（`llman-sdd-apply`）

### 1. Eden cancel 接线与 inbox 刷新

- [x] 1.1 `useEdenLabController`：实现 `cancel()`（`edenResearchApi.cancelResearchRun`）；成功后 `stopStream`、本地 `cancelled` 态、`useResearchTasks.refresh`（依赖 c84）
- [x] 1.2 `ResearchLabPage`（eden）：queued / running / awaiting_confirm 暴露取消；顶栏和/或 `ResearchTasksDrawer` 行操作
- [x] 1.3 取消中禁用重复提交；失败展示 `lastError`；成功后面向 cancelled 终态

### 2. Primary action 与 Eden 生命周期对齐

- [x] 2.1 Eden 路径：queued / running 主操作映射 cancel（标签如「取消研究」），MUST NOT 调用空 `pause()`
- [x] 2.2 awaiting_confirm 保持「生成结论」+「继续深挖」；`runPrimary` 不变
- [x] 2.3 fixture 路径保持 pause / resume 演示语义

### 3. Compose 模式文案与示例主题

- [x] 3.1 `LabComposePanel`：接受 `mode: 'eden' | 'fixture'`；分支标题说明、hint、示例按钮文案
- [x] 3.2 Eden：移除 fixture / xlsx / 演示回放权威表述；fixture 保留既有演示 copy
- [x] 3.3 `ResearchLabPage` 传入 `mode` 与中性 `exampleTopic`（eden）

### 4. 验证

- [x] 4.1 Vitest：`LabComposePanel` eden | fixture 文案快照；Eden primary → cancel 映射
- [x] 4.2 Vitest：`cancel` 成功后 mock `refresh` 被调用
- [x] 4.3 `cd apps/web && bun run test:ci`（相关子集）+ `bun typecheck`
- [x] 4.4 `llman sdd validate c86-lab-cancel-and-compose-eden-copy --strict --no-interactive`
