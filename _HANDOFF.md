# _HANDOFF.md — 2026-09 P3 跟进台账（第二轮）

> 临时追踪文件，收口后删除（第一轮台账已于 29667551 收口删除）。
> 2026-09-16：对第一轮遗留的三项 P3 可选项做了证据复核，结论与规划记录于此。

## 背景与判定

第一轮台账收口时遗留三项 P3（历史提交可查），本轮逐项复核：

| 遗留项                                           | 复核结论                                                                                                                                                                                                                                                                            | 载体             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Lab 图谱键盘可达性                               | **真实用户可见缺陷，需要提案**。r406（deep-research-ui.feature）只规定了「单击节点 MUST 打开 inspector」，键盘路径为零合约：`onNodeClick`（LabGraph.tsx:594）仅响应鼠标；边分叉/剪枝按钮（LabGraph.tsx:279/292）由 hover 态控制可见，键盘不可达。属于行为合约新增 → MUST 走 propose | SDD 提案 c66     |
| server config.ts(1086) / run-loop.ts(984) 三段拆 | 纯重构，无 MUST/SHALL 变更；run-loop 已确认**无模块级可变状态**（状态全在 DB/run-locks/SSE），拆分机械；依赖均按 specifier import，bun mock.module 不受文件搬迁影响                                                                                                                 | 直改波次 W9      |
| SourcesPanel/ChatPanel 直连 store 砍 props 链    | 维持搁置。WorkspaceLayout.tsx:212 有刻意的渲染隔离调优（Chat Virtuoso），改订阅拓扑需谨慎评估；收益（砍 ~45-prop 接口）真实但纯代码质量                                                                                                                                             | 挂起，触达时顺路 |

## 执行计划（按序）

### 1. SDD 提案：`c66-research-graph-keyboard-access`

- 编号 c66（c65 已归档；命名符合 r29 `^c[0-9]+-[a-z0-9-]+$`），req-id 用 `llman sdd spec next-req-id` 分配。
- **合约**：deep-research-ui.feature 新增一条 req（紧邻 r406）——键盘用户 MUST 能打开节点 inspector（Tab 聚焦节点 + Enter/Space 等价于单击），且边的 fork/prune 操作 MUST 可键盘触达（不能仅 hover 可见）；completed 等只读态的禁令（r406/r407）对键盘路径同样适用。
- **实现草图**（LabGraph.tsx，约半天含测试）：
  - 节点侧：`LabFlowNode` 内层加 `onKeyDown`，把 `onSelectNode` 塞进 node data；
  - 边侧：fork/prune 按钮常驻 DOM，可见性改 `group-hover` / `group-focus-within` 控制（按钮本就是 `<button>`，Tab 序即边序）。
- **锁测试**：LabGraph 键盘交互测试（Enter 开抽屉、Tab 可达边操作）。
- **门禁**：`just qa`；pipeline propose → apply → verify → archive。

### 2. 直改波次 W9：server 神文件三段拆

- config.ts：模板表达式引擎（renderTemplates/resolveExpression/splitTopLevel/applyFilter，纯函数）／加载与单例（dotenv/路径/loadConfig/config()）／按域访问器（models/research/其余）三段；旧路径 re-export 保住 import 面。
- run-loop.ts：work-unit 执行（runNodeWorkUnit ~226 行 + ingestWorkToolResult/writeBackNodeWork/patchNodePhase）／编排（runLoop/drainResearchWorkUnits/maybeAutoDecompose/enterConfirm）／abort/sleep helpers 三段。
- **门禁**：`just qa` + 额外跑 `just test-bdd` 与 research 全套（W3 chat-mutex 测试对 run-loop 敏感）。
- 红线：纯搬运零行为变更；发现 MUST/SHALL 牵连立即停手转 propose。

### 3. 收口

- `llman sdd validate --all --strict` 全绿；AGENTS.md 状态行按需同步；删除本文件。

## 挂起（本轮不做，触达时顺路）

- **SourcesPanel/ChatPanel 直连 store**：下次因功能需求触达面板时评估，顺序 Sources 先（props 最多、无 Virtuoso 敏感度）、ChatPanel 最后甚至不做；改前先读 WorkspaceLayout.tsx:212 的渲染隔离注释与 W6 台账结论。

## 纪律提醒（沿第一轮）

- 一波一主题；`just qa` 全绿才 commit（pre-commit oxfmt 会自动改文件，需 re-add 后重新 commit）。
- 新 desc() key 必须同步 `packages/shared/src/i18n/zh/index.json`（check-i18n-keys 门禁）。
- 波次中发现 MUST/SHALL 变更 → 立即停手转 `/llman-sdd-propose`。
- 本地 main 领先 origin 若干提交，未经用户明示不 push。
