---
depends_on: [c75-workspace-topbar-search]
---

## Why

旧 Deep Research 已 stub（`POST …/research` → 501），无法支撑产品基线（`docs/product/deep-research-prd.md` §0 + 本 change design Runtime wire）：**ResearchRun SSOT**、原子 tools、可交互图（剪枝/fork）、结构化报告+citation map、显式双开关创建、M1 轻量确认、显式转化（PARAGRAPH+K1 / Source embed）。c75 已完成顶栏 E1 + 直接搜索；本 change **落地后端 Runtime 全量合约与实现**；FE/xyflow 仅占位（另 change）。

## What Changes

1. **ResearchRun SSOT（B）**：notebook 作用域 create / list / get；图、checkpoint、evidence、权威 report+citations 挂 Run；**不**自动写 Output（B1）。
2. **替换 501**：合法创建返回 Run id + `queued`；异步推进；GET SSE（R3b）。
3. **Create（H1′）**：`topic` + `useNotebookSources`/`allowWeb`（默认 true）+ 台内 `sourceIds` + `depth`（L1）；校验见 **design.md §1**；**不**绑 workspace 勾选。
4. **状态机（R2a）**：`queued|running|awaiting_confirm|completed|failed|cancelled`。
5. **执行**：共享 `searchWeb`；retrieve；evidence 行（**EV1**）；synthesizeReport（R6a）；checkpoint（**CP1**）；协作 cancel（**A1**）。
6. **图**：节点结论态 R4；边闭集 R5；SSE `graph_patch`（**D1**）；prune/fork（**U2**，与 M1 扩支路同面）。
7. **M1 confirm**：预算将尽 / 扩支路；`continue|finish_report|approve_branch|skip_branch`。
8. **转化（R7）**：`artifact` = report|node|evidence → note（PARAGRAPH+K1）或 source（ingest+embed）。
9. **错误（ERR-G1）**：复用 `AppHttpError`；仅增 `RESEARCH_INVALID_STATE`、`RESEARCH_BUDGET`。
10. **FE 占位**：不实现 xyflow/Desk；契约与 Zod 可供后续 FE change；UI 决策见 ui-proto（U1/E1′/F1-CTA/UI-C1/C1 色）。

## Capabilities

- `deep-research-runtime`（新）— 上列全部后端 MUST
- `structural-refinement-for-generated-results` — 指向本 capability，不再承载深研 MUST

## Impact

- **BREAKING**：`POST …/research` 不再 501；与旧 HITL 会话语义不兼容。
- DB：runs + graph/checkpoint/evidence（或等价 JSON）+ notebook FK。
- Shared Zod + Eden/OpenAPI；`just qa`。

## SSOT（grill 已收口）

- `docs/product/deep-research-prd.md` §0 — 产品决策索引
- **本 change `design.md`** — 后端 Runtime wire（原 runtime-spec 已并入）
- `docs/product/deep-research-ui-proto.md` — FE 决策（另 change 实现）
- delta `deep-research-runtime` r300–r315 — MUST 合约
