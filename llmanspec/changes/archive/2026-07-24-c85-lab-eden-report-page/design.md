# Design: c85 Lab Eden report page

## Scope

在 c82 Eden 接线基础上，将 **报告页导航、加载与导出** 从 fixture stub 切到 `ResearchRun.report` SSOT。无新 API；复用既有 `GET …/research/:rid` 与 shared `ResearchReportSchema`。

## 报告打开流

```
用户点「查看报告」/ 抽屉「打开独立报告页」/ chat open_report 提案
    → openReport()（eden）
        → navigateToLabReport(notebookId, runId)  // ?rid= 与 graph 页一致
    → LabReportPage（eden mode）
        → getResearchRun(notebookId, rid)
        → 渲染 report.sections + CitationsControl(report.citations)
```

Fixture 路径保持 `ensureDefaultRevision` + `navigateToLabReport`（无 `rid`）不变。

## 路由与 rid

| 页面   | URL                              | rid 来源                               |
| ------ | -------------------------------- | -------------------------------------- |
| Graph  | `/research-lab/:nid?rid=`        | `readActiveRunIdFromUrl()`（c82 已有） |
| Report | `/research-lab/:nid/report?rid=` | 同 query；缺失时 MAY 提示返回作业台    |

`parseResearchLabPath` 不变；`navigateToLabReport` 扩展可选 `runId` 写入 query。

## 数据与展示

| 字段     | Eden SSOT                                         | Fixture（保留）              |
| -------- | ------------------------------------------------- | ---------------------------- |
| 报告正文 | `run.report.sections` → Plate/只读渲染            | `labRevisions` + `reportCow` |
| 引用     | `run.report.citations` → CitationsControl adapter | `scenario.citations`         |
| 标题     | `run.report.title`                                | scenario / revision label    |

Eden 模式 MUST NOT 调用 `ensureDefaultRevision` / `readLabSessionSnapshot` 作为权威。

## 导出

`exportSuggestedFromGraph`（eden）：

1. 若 `run.report` 存在 → 序列化为 markdown（复用或抽取 `resolveDefaultExportMarkdown` 的 report 分支）
2. 否则 toast 可见错误（无报告）
3. MUST NOT 写 fixture revision

## Seams

| 组件 / 模块                      | 职责                                                   |
| -------------------------------- | ------------------------------------------------------ |
| `ResearchLabPage`                | eden `openReport` / `exportSuggestedFromGraph` 去 stub |
| `labRouting`                     | `navigateToLabReport(nid, rid?)`                       |
| `LabReportPage`                  | `mode: 'eden' \| 'fixture'`；eden loader               |
| `App.tsx`                        | 传入 report 页 mode + rid                              |
| `edenResearchApi.getResearchRun` | 已有 GET                                               |
| CitationsControl adapter         | r408 最小映射                                          |

## 与邻接 change 边界

- **c87**：节点抽屉 evidence 不在本变更；报告脚注引用可复用 citation map
- **c89**：revisions / working CoW / convert 留给 c89；本变更只读权威 `report`
- **c88**：`open_report` 提案导航目标与本变更一致

## Guardrails

- MUST NOT 第二套 report wire DTO（Eden + shared only，r423）
- MUST NOT 在 Eden 默认路径保留 stub toast
- fixture（`VITE_LAB_FIXTURE=1`）报告行为 MAY 不变

## Testing

- Vitest：`openReport` eden → 导航含 `rid`；`exportSuggestedFromGraph` 不调 toast stub
- Vitest：`LabReportPage` eden loader mock `getResearchRun` 渲染 title/section
- 手测：completed Run → 报告页可见正文与引用入口
