## 1. Specs（提案）

- [x] 1.1 proposal / design / tasks + grill 决策表
- [x] 1.2 delta `deep-research-ui` + `workspace-ui-panels` modify
- [x] 1.3 `llman sdd validate c77-deep-research-ui --strict --no-interactive --stage spec`
- [x] 1.4 删除 `docs/product/deep-research-prd.md`、`deep-research-ui-proto.md`；更新 c76 proposal SSOT 指向 llmanspec

## 2. Desk（E1 deep tab）

- [ ] 2.1 `DeepResearchDesk` 替换 `DeepResearchShell`（H1′ + L1 + 加宽）
- [ ] 2.2 队列卡片 + 轻量轮询/事件刷新（Q3）
- [ ] 2.3 台内来源多选；空态/断连/无 notebook gating

验证：Vitest 创建禁用条件；手动开 deep tab

## 3. Run 详情 Layer

- [ ] 3.1 modal Layer 详情；G1 E1 保持；Esc/遮罩层级（#4/#5/#14）
- [ ] 3.2 状态主表面切换 + 报告草稿折叠底栏（Q2/#23）
- [ ] 3.3 订阅 Run SSE；M1 顶栏确认条（F1-CTA）
- [ ] 3.4 Cancel；Convert toast（#10）

验证：Vitest Escape/主表面；联调 SSE

## 4. ResearchGraph + inspector

- [ ] 4.1 新 `ResearchGraph`（D1 patch、R4/C1）；不改 MindmapViewer
- [ ] 4.2 选中 → inspector；prune/fork 轻确认 + 可选 hint
- [ ] 4.3 E1′ Convert 淡化入口；完成后图只读

验证：组件测 patch/只读；联调 prune

## 5. Citations + 错误 + i18n

- [ ] 5.1 citation map → CitationsControl adapter（#11）
- [ ] 5.2 RESEARCH_* 内联 + toast（#12）
- [ ] 5.3 用户文案 `t()`（#19）

验证：adapter 单测

## 6. 退役 HITL + 门禁

- [ ] 6.1 删除/切断旧 research HITL 与 Sources 深研队列/历史及相关测
- [ ] 6.2 e2e `@p0`：开 deep tab 见 Desk
- [ ] 6.3 `bun typecheck` + `just test-web` + 相关 server 测不回归
- [ ] 6.4 `just qa`

验证：`just qa`
