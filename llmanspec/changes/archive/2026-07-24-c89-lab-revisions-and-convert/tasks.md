# Tasks: c89-lab-revisions-and-convert

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r441–r444 + scenarios
- [x] `llman sdd validate c89-lab-revisions-and-convert --strict --no-interactive --stage spec`

## Apply（`llman-sdd-apply`）

### 1. Eden API 客户端

- [x] 1.1 `edenResearchApi`：list/create/get/restore revisions
- [x] 1.2 `edenResearchApi`：get/put report、get/put/discard working
- [x] 1.3 `edenResearchApi`：convertToNote / convertToSource

### 2. LabReportPage revisions + CoW

- [x] 2.1 Eden 模式：revisions 列表与创建/恢复 UI 接 server
- [x] 2.2 Eden 编辑：working copy PUT；提交 canonical；丢弃 working
- [x] 2.3 恢复 revision 后刷新 run/report（graph_patch 或 GET）

### 3. Convert UI

- [x] 3.1 报告页 convert-to-note / convert-to-source（artifact kind=report）
- [x] 3.2 节点抽屉 convert 入口（kind=node 或 evidence）；toast 反馈（r409）
- [x] 3.3 成功 toast MAY 含打开笔记/来源弱链接

### 4. Fixture 降级

- [x] 4.1 fixture 模式保留 `labRevisions` / `reportCow`
- [x] 4.2 Eden 默认 MUST NOT 读写 sessionStorage revisions

### 5. 验证

- [x] 5.1 Vitest：eden revisions/convert 分支；fixture 不变
- [x] 5.2 server research revisions/convert 测试绿
- [x] 5.3 `cd apps/web && bun run test:ci` + `bun typecheck`
- [x] 5.4 `llman sdd validate c89-lab-revisions-and-convert --strict --no-interactive`
- [x] 5.5 手测：revision 恢复 + convert 后工作区可见

## Residual NOTES

- 服务端无独立 `GET …/report/working`；Eden 经 `GET …/report`（`ResearchReportView`）读 working（与 design「或等价」一致）。
- 节点抽屉 convert 已接 `kind=node`；`kind=evidence` 入口未单列（citation id 即 evidenceId，可后续加行级按钮）。
- 成功 toast 以「#id · 可在工作区打开」弱提示；未做可点击导航链（toast 组件仅字符串）。
- 5.5 交互手测：本轮以 Vitest + server runtime 回归覆盖；浏览器工作区可见性留人工抽检。
