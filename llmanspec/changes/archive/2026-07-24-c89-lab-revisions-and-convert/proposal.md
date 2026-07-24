---
depends_on: [c85-lab-eden-report-page, c78-deep-research-kernel]
---

## Why

c76/c78 规划了 report/graph **revisions（CoW）** 与 **convert**（report|node|evidence → note/source）。Lab fixture 仍用 `labRevisions` / `sessionStorage` 与 `reportCow` working copy；Eden 默认路径未接服务端 revisions API，也无法把成果写回笔记本。报告页（c85）落地后需要持久修订与转化闭环，对齐 live r419（revisions UI over server snapshots）与 r409（convert toast feedback）。

## What Changes

1. **Revisions**：Eden 报告页 MUST 经 `GET/POST …/revisions`、`GET …/revisions/:revId`、`POST …/restore` 列表/创建/恢复；替代 Eden 路径下 sessionStorage 权威。
2. **Report CoW**：working copy MUST 经 `GET/PUT …/report/working` 与 `PUT …/report`（canonical）；丢弃 working MUST 调用服务端 discard（或等价 DELETE working）。
3. **Convert**：报告页与节点抽屉 MUST 调用 `POST …/convert-to-note` / `convert-to-source`（`ResearchArtifactRef`）；成功/失败 toast（r409），MAY 弱链接打开笔记/来源。
4. **与 c85 衔接**：c85 只读权威 report；本变更接管编辑/revisions/convert。
5. **Fixture 隔离**：`labRevisions` / `reportCow` 仅 fixture 开关下演示。
6. **质量**：server revisions/convert 测 + Lab Vitest + 手测转化后工作区可见。

## Capabilities

- `deep-research-ui` — 报告修订与转化 UI

## Impact

- depends_on c85（Eden 报告页壳）与 c78（revisions/convert API）
- 对话 `@`/`/` 嵌入仍延后另 change
- 浏览器已证：`LabReportPage` 全文 sessionStorage；convert 未接 Eden

## Seams

- `edenResearchApi` revisions + report working + convert 方法
- `LabReportPage` mode 分支（revisions 列表、CoW 编辑、convert 按钮）
- `LabNodeDrawer` convert 入口（淡化，r406）
- fixture `labRevisions` / `reportCow` 降级

## Residual NOTES（apply）

- 服务端无独立 `GET …/report/working`；Eden 经 `GET …/report`（`ResearchReportView`）读 working。
- 节点抽屉 convert 已接 `kind=node`；`kind=evidence` 行级入口未单列。
- 成功 toast 以「#id · 可在工作区打开」弱提示（toast 仅字符串，无可点链）。
- 浏览器工作区可见性留人工抽检；Vitest + server runtime 已绿。
