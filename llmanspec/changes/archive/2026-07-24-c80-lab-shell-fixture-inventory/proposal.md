---
depends_on: [c79-retire-legacy-deep-search-entry]
---

## Why

c79 清掉搜索深研入口后，需要把 `/research-lab` 明确为深研**作业台**，并用**既有写死任务 `xlsx-lib`** 跑通 Lab 设计面，同时产出「Lab UX ↔ ResearchRun API」盘点，供 c81 改合约、c82 接线。本 change **仍以 fixture/mock 为会话权威**，不接真 Run。

**当前产品闭环（已足够，不再依赖对话嵌入）**：

- **创建**：Lab 空态 Compose（烧瓶 / 任务抽屉「新建」进 Lab）
- **进行中 / 历史切换**：统一任务列表 — 工作区头像旁 + Lab 顶栏最右（badge）
- **作业台**：Lab 图 / 报告大表面

对话 `@` / `/` 创建与引用：**明确延后**，不进本链路 Non-Goals 以外的规划；另开 change 再议。

## What Changes

1. **产品定位**：`/research-lab/:nid` 为深研作业台；文档/AGENTS 去掉「仅 Fake Demo」歧义（可保留「fixture 直至 c82」）。烧瓶 = 进 Lab 捷径；Compose = 创建；任务抽屉 = 切换/恢复。
2. **写死任务**：默认/主路径锁定 scenario **`xlsx-lib`**；Compose → 回放 → 报告主路径可走通。
3. **任务队列（demo）**：头像旁 + Lab 顶栏共用任务抽屉；fixture `demoResearchTasks`；inventory 对照真 `GET …/research` list。
4. **盘点工件**：`inventory.md`（Keep/Gap/Extra/Ambiguous）含 Compose、任务列表/badge、图表面；对话 `@` 标 **deferred**。
5. **端口雏形**：`LabSessionPort`（或等价）；fixture 实现；**禁止**本 change 以 Eden research 为权威。
6. **Non-Goals**：改 ResearchRun Zod/路由（c81）；Eden 接线（c82）；**对话 `@`/`/` 嵌入创建或引用**；新建第二套 scenario。

## Capabilities

- `deep-research-ui` — Lab 作业台 + Compose + 任务队列 demo + 盘点

## Impact

- depends_on `c79-retire-legacy-deep-search-entry`
- 用户深研体验：Compose/任务列表（demo）+ Lab+xlsx-lib；真 API 至 c81/c82
- blocks：`c81-align-lab-research-api`

## Open Questions（已决）

| 题       | 决                                               |
| -------- | ------------------------------------------------ |
| fixture  | 仅 `xlsx-lib`                                    |
| 作业台   | `/research-lab`                                  |
| 任务列表 | 头像旁 + Lab 顶栏最右同一抽屉                    |
| 创建入口 | Compose + 烧瓶/抽屉进 Lab；**对话 `@`/`/` 延后** |
| Desk     | 已在 c79 卸下                                    |
