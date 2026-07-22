---
depends_on: []
---

## Why

Lab demo 已锁定**交互机制**（图剪枝/分叉、确认门、节点面板/聊天提案、画布设置、报告 CoW），但未精致定稿视觉。c76 `runLoop` 仍是近线性 stub，缺 **单结论 DAG / `role` / fork→merge / 可演进内核**，正式 Desk 无法用同一套端口承接 Lab。

需要一次 **API 优先、A+B+C 一步到位** 的落地：图与编排 SSOT 在后端；前端只做展示与正确调用命令口；命令口覆盖既有路径、节点 PATCH、节点 chat、以及 revisions / 画布机制迁移。

## What Changes

1. **A · Runtime 既有口收紧 + 内核**
   - 单结论 DAG + `role`；串行 work-unit（CP1 + Abort + discard-if-pruned）
   - `approve_branch` → research + **merge→唯一 conclusion**
2. **B · `PATCH …/nodes/:id`**
   - 窄 body：`title?` / `query?` / `conclusionStatus?`（live only）
3. **C · 补齐交互口与机制迁移**
   - **C1** `POST …/nodes/:id/chat` SSE（§7.3/7.4；提案 accept→命令口）
   - **C2** Run 级 report/graph **revisions（CoW）** API（替代 Lab sessionStorage 权威）
   - **C3** Desk 接入 Lab 级画布机制（方向/算法/小地图等偏好；不另立编排）
4. **UI**
   - 薄客户端 + role 优先渲染；接线 chat / PATCH / revisions；画布 chrome 从 Lab 迁 Desk
5. **仍不做**
   - 报告正文 token 进 Run stream（r311）；整图 `PUT`；静默改图 tool

## Capabilities

- `deep-research-runtime` — r317–r323
- `deep-research-ui` — r415–r419

## Impact

- Wire：`role`；PATCH；chat SSE；revisions 资源
- 既有路径保留并变厚；Desk/Lab 机制对齐后端 SSOT
- §3 API **已锁 A+B+C（2026-07-23）**；Apply 按 A→B→C 波次
- 门禁：`just qa` 相关 + research/chat/revisions 测
