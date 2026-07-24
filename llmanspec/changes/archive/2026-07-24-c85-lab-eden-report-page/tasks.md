# Tasks: c85-lab-eden-report-page

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r430–r433 + scenarios
- [x] `llman sdd validate c85-lab-eden-report-page --strict --no-interactive --stage spec`

## Apply（`llman-sdd-apply`）

### 1. 报告路由与导航

- [x] 1.1 `labRouting.navigateToLabReport(notebookId, runId?)`：写入 `?rid=`；与 graph 页 query 一致
- [x] 1.2 `ResearchLabPage`（eden）：`openReport` 导航至报告页并携带当前 `runId`；移除 stub toast
- [x] 1.3 完成态 CTA（顶栏/抽屉/chat `open_report`）统一走同一导航

### 2. LabReportPage Eden 加载

- [x] 2.1 `LabReportPage` 接受 `mode` + `runId`；eden 分支 `getResearchRun` 加载 `report`
- [x] 2.2 渲染 `report.sections`；无 report 时展示可见空态/错误
- [x] 2.3 CitationsControl adapter：`ResearchReport.citations` → UI Citation（r408）

### 3. 导出

- [x] 3.1 `exportSuggestedFromGraph`（eden）：从 `run.report` 导出 markdown；移除 stub toast
- [x] 3.2 无 report 时 toast 错误；MUST NOT 写 fixture revision

### 4. 验证

- [x] 4.1 Vitest：eden `openReport` / export 导航与 loader 分支
- [x] 4.2 `cd apps/web && bun run test:ci`（相关子集）+ `bun typecheck`
- [x] 4.3 `llman sdd validate c85-lab-eden-report-page --strict --no-interactive`
- [x] 4.4 手测：completed → 报告页正文 + 引用
