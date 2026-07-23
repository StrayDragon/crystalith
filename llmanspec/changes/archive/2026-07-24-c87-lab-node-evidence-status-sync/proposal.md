---
depends_on: [c82-wire-lab-eden]
---

## Why

浏览器全链路：Run 已 `completed` 且服务端已收集 evidence（节点 `evidenceIds` 非空），但 Eden 作业台节点抽屉「信息引用源」仍显示「暂无引用」——因 `LabNodeDrawer` 仍接收 fixture `lab.scenario.citations` 而非 Run 证据。同时结论节点卡片长期显示「排队…」、顶栏进度条在 `awaiting_confirm` 时仍示「多源探索 + 暂停」横幅，图/抽屉展示未消费 Run 终态与 evidence，观感与 API 脱节。

## What Changes

1. **Evidence → 引用列表**：Eden 路径 MUST 将节点 `evidenceIds` 映射为抽屉引用列表（至少 id + 标题/snippet）；当 evidence 已存在时 MUST NOT 显示空壳「暂无引用」。
2. **证据来源**：优先 `GET run` 返回的 evidence 形（或 `report.citations` + `evidenceIds` 联表）；若 shared 缺字段，本变更 MAY 最小补 `ResearchRun.evidences`（server + shared）——UI delta 仍以展示合约为准。
3. **节点终态展示**：`completed` / `failed` / `cancelled` 后节点 phase/状态文案 MUST 反映服务端终态（结论节点 MUST NOT 长期「排队…」）。
4. **SSE / reload 对齐**：`graph_patch` 与终态 `status` / `report_ready` 后 MUST `getResearchRun` 或等效刷新以对齐 `node.phase` / `conclusionStatus`；completed 时强制全量对齐。
5. **进度与 playing**：`awaiting_confirm` 时 MUST NOT 同时展示「多源探索」playing 横幅与「已暂停」矛盾文案；`playing` 推导 MUST 与 Run status 一致。
6. **质量**：adapter/Vitest + 手测 completed 抽屉引用非空、结论节点终态正确。

## Capabilities

- `deep-research-ui` — 节点证据与状态展示同步

## Impact

- depends_on `c82-wire-lab-eden`
- 可与 c85 并行；c85 报告引用可复用本 change 的 evidence/citation 映射
- 不含报告页接线（c85）、chat（c88）、revisions（c89）

## Seams

- `researchGraphAdapter` / `evidenceToLabCitation`（新或扩展现有 adapter）
- `ResearchLabPage` → `LabNodeDrawer` citations prop（eden 分支）
- `useEdenLabController` 终态 GET refresh
- `LabGraph` / `labLayout` 节点 status 标签推导
- `LabProgressBar` / `playing` / 暂停横幅条件（`ResearchLabPage`）
