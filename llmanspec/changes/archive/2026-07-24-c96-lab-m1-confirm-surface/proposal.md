---
depends_on: [c82-wire-lab-eden, c95-lab-progress-ledger-panel]
---

## Why

c76/c78 定义 M1 确认（`budget` / `expand_branch` + `continue|finish_report|approve_branch|skip_branch`）；c82 已接线 Eden `POST …/confirm`，但作业台在 `awaiting_confirm` 时仍部分沿用 fixture 文案与动作集合——缺 `skip_branch`、缺 `confirmKind` 分化说明、未稳定高亮 `confirmBranchNodeId`，预算/非法态错误未完整对齐 r410。本变更收口 M1 确认条与图高亮，落实 r407 在 Eden 路径的剩余缺口。

## What Changes

1. **confirmKind 文案**：`awaiting_confirm` 时顶栏确认条 MUST 按 `confirmKind=budget` 与 `expand_branch` 展示不同标题/说明（预算将尽 vs 扩支路提议）。
2. **分支高亮**：当 Run 携带 `confirmBranchNodeId` 时，LabGraph MUST 高亮对应节点/区域（复用 `highlightedNodeIds` 或等价）。
3. **动作全集**：确认条 MUST 暴露 `continue`、`finish_report`、`approve_branch`（仅 expand_branch）、**`skip_branch`**（expand_branch）；Eden 均经 `confirmResearchRun`。
4. **错误映射**：`RESEARCH_BUDGET` / `RESEARCH_INVALID_STATE` MUST 内联或 toast 可见（对齐 r410）；MUST NOT 静默失败。
5. **非目标**：MUST NOT 恢复逐步计划审批 UI。
6. **质量**：Vitest 覆盖 confirmKind 文案分支、skip_branch 调用、高亮 prop；手测 budget 与 expand_branch 各一轮。

## Locked decisions

- **BDD-off**；Apply：**全程 main**（本 change archive+commit 后才开下一条）
- Fixture（`VITE_LAB_FIXTURE=1`）保留至 c100；产品默认 Eden
- **M1 保留** budget + expand_branch；本变更补齐 `skip_branch` UI + 分支高亮
- 相位富化走 c97（progress+图状态）；本变更不引入 timer SSOT
- **本波 MUST NOT 再延后**；c99 保留在同波

## Capabilities

- `deep-research-ui` — M1 确认条与图高亮

## Impact

- depends_on c82（Eden confirm 客户端）与 c95（进度/ledger 上下文，避免与 playing 横幅矛盾）
- 无服务端合约变更（c76 confirm body 已含 skip_branch）
- 强化 r407 / r410；不触碰 revisions（c89）或 phase 映射（c97）

## Seams

- `ResearchLabPage` — 确认条文案与动作按钮
- `useEdenLabController` — confirm 动作映射、`highlightedNodeIds` / `confirmBranchNodeId`
- `LabGraph` — 高亮渲染
- `confirmResearchRun` / Eden error envelope → r410 展示
