---
depends_on: []
---

## Why

来源栏/顶栏「搜索入口 · 深度研究」双轨与薄 `DeepResearchDesk` 并存，和「以 Lab 为深研主表面」的产品方向冲突。死代码（`SourcesPanelSearchSection`）、`SearchMode` 中的 Deep、以及把 `sources.search.mode` 语义当成深研的入口残留需要先清干净；**不得**触碰 c76/c78 的 ResearchRun HTTP 面。

## What Changes

1. **移除顶栏 E1 deep Tab 与 `DeepResearchDesk` 挂载**：顶栏搜索面板仅保留「直接搜索 / Fast」；不再在顶栏内嵌深研 Desk。
2. **删除死 FE**：`SourcesPanelSearchSection`、Deep/Fast 模式切换相关类型与 utils/测试、无用 deep-search i18n、legacy HITL testid（若无引用）。
3. **收敛网搜 `mode` 语义**：`sources.search` 的 `mode` MUST NOT 再表示「深度研究」；客户端固定 Fast（或等价）；schema/文档标明其为网搜通道元数据，非 ResearchRun。
4. **保留入口**：工作区烧瓶 / `/research-lab/:nid` 仍为深研试验/主表面入口（c80 升格）；**MUST NOT** 删除 `apps/server/src/features/research/**`、shared research schemas、或 `/v2/notebooks/:nid/research*`。
5. **门禁**：typecheck + 定向 Vitest/e2e（顶栏无 deep tab / Desk；Lab 入口仍可达）。

## Capabilities

- `workspace-ui-panels` — 顶栏仅 Fast；移除 deep Desk 挂载
- `source-ingestion-core` — 网搜 mode 与深研解耦
- `deep-research-ui` — 退役 Desk 作为顶栏深研主入口（Lab 接棒见 c80）

## Impact

- **BREAKING（UI）**：用户不能再从顶栏 deep Tab 打开 DeepResearchDesk；深研走 `/research-lab`。
- **API**：可收紧 `SourceSearchRequest.mode` 描述/枚举；**禁止**删除 ResearchRun 路由。
- 后续：`c80` 盘点 + Lab 写死任务壳；`c81` 合约对齐；`c82` Eden 接线。

## Open Questions（已决）

| 题              | 决                             |
| --------------- | ------------------------------ |
| Desk            | c79 卸下；不以 Desk 为生产入口 |
| 主表面          | `/research-lab`（c80+）        |
| fixture         | c80 用既有 `xlsx-lib`          |
| ResearchRun API | 全程保留                       |
