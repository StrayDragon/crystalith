---
depends_on: [c82-wire-lab-eden]
---

## Why

c82 作业台已能跑到 `completed` 且 API 返回 `ResearchRun.report`（含 citations），但 Eden 路径仍 toast「Eden 报告页待接 / 导出待接」。用户在结论抽屉点「打开独立报告页」、顶栏「查看报告」或从图导出建议报告时无法进入真实报告面，产品闭环在最后一公里断裂。

## What Changes

1. **报告页导航**：`openReportMode=eden` 时 `openReport` MUST 导航至 `/research-lab/:nid/report?rid=`（沿用 graph 页 `rid` query），MUST NOT toast stub。
2. **权威加载**：`LabReportPage` Eden 模式 MUST 以 `GET …/research/:rid` 的 `report`（及 citations）为 SSOT；MUST NOT 以 fixture `labRevisions` / `sessionStorage` 作为 Eden 默认权威。
3. **引用展示**：报告面 MUST 复用 CitationsControl（对齐 r408），经 adapter 将 `ResearchReport.citations` 映射为 UI 所需形。
4. **导出**：`exportSuggestedFromGraph` Eden 路径 MUST 从当前 Run 报告或等价结构化导出生成 markdown，MUST NOT toast「待接」。
5. **完成态 CTA**：`completed` 且 `report` 存在时，顶栏/抽屉「查看报告」「打开独立报告页」MUST 走同一报告路由。
6. **质量**：Vitest（路由 + loader 分支）+ 手测：confirm finish → completed → 打开报告可见正文与引用。

## Capabilities

- `deep-research-ui` — Eden 报告表面与导航

## Impact

- depends_on `c82-wire-lab-eden`
- 不含 revisions CoW / convert（c89）；不含 node evidence 抽屉（c87）、node chat（c88）
- 浏览器已证：`ResearchLabPage.openReport` / `exportSuggestedFromGraph` 在 eden 模式仅 toast

## Seams

- `ResearchLabPage.openReport` / `exportSuggestedFromGraph` / `LabWorkbench` CTA
- `labRouting.navigateToLabReport`（扩展携带 `rid`）
- `LabReportPage` 数据加载（notebookId + rid + mode）
- `edenResearchApi.getResearchRun` + `ResearchRun.report`
- CitationsControl adapter（r408）
