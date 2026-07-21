---
depends_on: [c76-deep-research-runtime]
---

## Why

`c76` 落地 ResearchRun 后端合约后，顶栏 E1「深度研究」仍为壳（c75），旧 HITL 深研 UI 与产品决策（Grill 4–24 + ui-proto）不一致。需要一次 FE change 接上 Desk / Run 详情 / 图交互，并退役双轨。

## What Changes

1. **DeepResearchDesk** 替换 `DeepResearchShell`：H1′ 双开关 + 台内来源多选 + L1 深度；空选/非法组合禁用开始；deep 内容区加宽。
2. **队列活卡片**：`GET …/research` 初始拉取；存在非终态时 3–5s 轻量轮询；创建/详情返回/终态变更后立即刷新；**不**为 list 开 SSE（日后可升 C，本 change Non-Goal）。
3. **Run 详情 Layer**：`modal` 盖住 E1（`popover`）；G1 保持 E1 挂载；Esc/遮罩先关详情；同时仅一个详情。
4. **主表面按状态**：过程态 xyflow 为主、报告草稿默折叠底栏；`completed` 报告为主、图只读次级；M1 顶栏确认条（F1-CTA）。
5. **ResearchGraph**（新，不复用 MindmapViewer）：D1 `graph_patch`；R4/C1 语义色；单击 → inspector；U2 prune/fork 轻量二次确认；E1′ Convert 入口淡化。
6. **UI-C1**：复用 `CitationsControl` + Run citation map adapter；Convert 成功/失败 toast（无转化弹窗）。
7. **错误**：`RESEARCH_INVALID_STATE` / `RESEARCH_BUDGET` 内联 + toast；其余 `AppHttpError`。
8. **退役旧 HITL FE**：删除/切断 `ResearchDetailPanel`、`useResearch`（旧）、`ResearchCapsule`、Sources 内 ResearchQueue/History/DetailModal 及仅服务 HITL 的 export/thinking；来源栏不再嵌深研队列。
9. **质量**：用户文案走 `t()`；Vitest（创建校验、主表面、Escape）；e2e `@p0` ≥1（开 deep tab 见 Desk）。
10. **文档收敛**：校验通过后删除 `docs/product/deep-research-prd.md` 与 `deep-research-ui-proto.md`；FE SSOT = 本 change；后端 SSOT = c76。

## Capabilities

- `deep-research-ui`（新）— Desk / 详情 / 图 / 转化反馈 / HITL 退役
- `workspace-ui-panels` — 修改「深研 Tab 仅为壳」；来源栏禁止深研队列

## Impact

- **depends_on** `c76-deep-research-runtime`（Zod/Eden/SSE）；联调与 `just qa` 以真实合约为准。
- 破坏性：移除旧 HITL 深研 UI 入口与组件；用户仅能从顶栏 deep tab 使用深研。
- 无 URL deep-link（P2）；无 notebook list SSE（Q3 可升 C）。

## SSOT（grill 已收口）

| 主题      | 决策                                                |
| --------- | --------------------------------------------------- |
| 范围      | 单 change 全 ui-proto 6 项 + 退役 HITL              |
| 主表面    | 按 Run 状态切换（Q2=A）                             |
| 队列      | 轻量轮询 + 事件点刷新（Q3=A；未来可 C）             |
| 层级      | E1=popover；详情=modal；Esc 先关详情                |
| 图        | 新 ResearchGraph；选中+inspector；prune/fork 轻确认 |
| 引用/转化 | CitationsControl adapter；toast；无转化弹窗         |
| 路由      | 不做 deep-link                                      |
| 文档      | validate 后删 docs/product 两份                     |

细则见 `design.md`。
