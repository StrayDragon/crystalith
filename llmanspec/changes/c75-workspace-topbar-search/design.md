## Context

- 产品基线：Deep Research PRD v0.2.1（IA-1 / E1 / B / B1）；本 change 只落地 **P-1 顶栏迁移**。
- 现有实现：Sources 面板内 `useSourcesPanelSearchMode` + Fast/Deep 切换；`@xyflow` 与深研 Runtime **不在本 change**。
- 旧 research HTTP 已 stub（501）；深研 Tab 不得复活旧 agent。

## Goals / Non-Goals

**Goals**：顶栏 E1 面板 + Fast 搜源可用；来源栏去主搜；深研壳；门禁绿。

**Non-Goals**：新 ResearchRun、xyflow 图、步骤转化、整本语义搜索、改 SearXNG 服务端契约。

## Decisions

| 决策          | 选择                              | 理由                        |
| ------------- | --------------------------------- | --------------------------- |
| 二级页形态    | E1 顶栏锚定宽幅面板               | 保留三栏上下文；非全屏路由  |
| Fast 搜源实现 | 复用现有 web search + ingest hook | 禁止双份 SearXNG 客户端逻辑 |
| 深研 Tab      | 只读壳 / 禁用开始                 | Runtime 另开 change         |
| z-index       | Layer 系统                        | 符合 workspace-ui-core r219 |

## Risks / Migration

- e2e 仍点旧 sources 搜索 testid → 同步改 fixtures 与 `@p0`。
- 面板遮挡 → Esc/遮罩关闭；宽度 `min(960px, 内容区)` 量级。
- 空态文案仍写「使用搜索导入」→ 改为指向顶栏或保持语义但入口变更。

## Rollback

还原顶栏组件与 Sources 搜索条；delta 未 archive 前可弃 change。
