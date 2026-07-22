---
depends_on: [c79-retire-legacy-deep-search-entry]
---

## Why

c79 清掉搜索深研入口后，需要把 `/research-lab` 明确为深研主表面，并用**既有写死任务 `xlsx-lib`** 跑通 Lab 设计面，同时产出「Lab UX ↔ ResearchRun API」盘点，供 c81 改合约、c82 接线。本 change **仍以 fixture/mock 为会话权威**，不接真 Run。

## What Changes

1. **产品定位**：`/research-lab/:nid` 为深研主表面（烧瓶为主入口）；文档/AGENTS 去掉「仅 Fake Demo、非正式」的歧义表述（可保留「fixture 驱动直至 c82」）。
2. **写死任务**：默认/主路径锁定 scenario **`xlsx-lib`**；启动后可走完 Lab 主设计面（图、节点抽屉、prune/fork、chat 提案、报告 Plate+cite、revisions、画布设置、progress 等）。
3. **盘点工件**：在本 change 下产出 `inventory.md`（或 design 附录）：逐项对照 Lab 表面 ↔ 现有 ResearchRun 命令/SSE/缺口/多余。
4. **端口雏形**：抽出 `LabSessionPort`（或等价）接口；fixture 实现；**禁止**本 change 调用 Eden research 作为权威。
5. **Non-Goals**：改 ResearchRun Zod/路由行为（c81）；Eden 接线（c82）；新建第二套 scenario（仅 xlsx-lib）。

## Capabilities

- `deep-research-ui` — Lab 主表面 + fixture 跑通 + 盘点

## Impact

- depends_on `c79-retire-legacy-deep-search-entry`
- 用户深研体验以 Lab+xlsx-lib 为准；真 API 仍库存至 c81/c82
- blocks：`c81-align-lab-research-api`

## Open Questions（已决）

| 题      | 决              |
| ------- | --------------- |
| fixture | 仅 `xlsx-lib`   |
| 入口    | `/research-lab` |
| Desk    | 已在 c79 卸下   |
