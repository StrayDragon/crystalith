## Context

- 后端 wire SSOT：`c76-deep-research-runtime/design.md`。
- E1 宿主已在 c75：`WorkspaceTopbarSearch`（`fast` \| `deep`）；deep 现为 `DeepResearchShell`。
- `@xyflow/react` 已在 web 依赖；`MindmapViewer` 仅作用法参考，**不**复用。
- Grill 收口：范围 A；主表面 A；队列 A（未来可 C）；#4–24 全部按推荐。

## Goals / Non-Goals

**Goals**：按 proposal What Changes 1–10 交付可观察 FE；消费 c76 HTTP/SSE；退役 HITL 双轨。

**Non-Goals**：改 c76 状态机/Zod 语义；notebook 级 list SSE；URL `?researchRun=` deep-link；P2 从节点 fork 新 Run；复活旧 HITL 字段名。

## Decisions（Grill → 实现）

| ID    | 决策                                                                      |
| ----- | ------------------------------------------------------------------------- |
| Scope | 单 change：Desk + Detail + prune/fork + Citation + Convert + M1 + 删 HITL |
| Q2    | 状态驱动主表面；无永久分栏；无「研究思路」页                              |
| Q3    | list：初始 GET + 非终态 3–5s 轮询 + 事件点刷新；详情 SSE 只管单 Run       |
| #4    | Esc/遮罩：详情优先；关详情不关 E1                                         |
| #5    | E1=`popover`；详情=`modal`（`useLayer`）                                  |
| #6    | deep 内容区加宽（如 `min(1100px,…)`）；fast 仍 ~960                       |
| #7    | 单击选中 → 右 inspector                                                   |
| #8    | prune/fork 轻量二次确认；fork 可选 `hint`                                 |
| #9    | 新建 `ResearchGraph`                                                      |
| #10   | Convert → toast（可弱链打开笔记/来源）                                    |
| #11   | CitationsControl + adapter                                                |
| #12   | RESEARCH_* 内联条 + toast                                                 |
| #13   | 卡片：topic/status/depth/相对时间/短进度                                  |
| #14   | 同时仅 1 个详情；换卡替换                                                 |
| #15   | 台内来源多选；不绑 workspace 勾选                                         |
| #16   | 无 notebook / 空队列 / 断连 gating                                        |
| #17   | 无 URL deep-link（P2）                                                    |
| #18   | 删除旧 HITL research 路径与 Sources 内深研队列/历史                       |
| #19   | `t()` i18n                                                                |
| #20   | Vitest + e2e `@p0` ≥1                                                     |
| #21   | `depends_on` c76；qa 不长期 mock 后端                                     |
| #22   | validate 后删 docs/product 两文档                                         |
| #23   | 非终态报告草稿默认折叠底栏                                                |
| #24   | list SSE = Non-Goal                                                       |

## Component map（建议落点）

```text
WorkspaceTopbarSearch
  └── DeepResearchDesk          # 替换 DeepResearchShell
        ├── CreateForm (H1′+L1)
        ├── RunQueue (poll)
        └── open → DeepResearchRunDetail (portal, modal layer)
              ├── M1ConfirmBar
              ├── ResearchGraph + NodeInspector
              ├── ReportSurface (+ CitationsControl adapter)
              └── Convert / Cancel actions
```

旧路径（删除或切断引用）：
`domains/research/ResearchDetailPanel.tsx`、`useResearch.ts`（旧会话）、`ResearchCapsule.tsx`、
`sources/components/SourcesPanelResearchQueue.tsx`、`ResearchHistoryDialog.tsx`、`ResearchDetailModal.tsx`、
以及仅 HITL 使用的 export/thinking/results 组件与相关测试。

## Risks

- c76 未完成时 FE 联调阻塞 → tasks 标明依赖 Zod/路由就绪；骨架可先写，qa 门禁等合约。
- Escape 与 E1 全局 listener 冲突 → 详情挂载时 stopPropagation / 条件关闭。
- Citation 形与 Chat `Citation` 不完全同构 → adapter 单测。
- 删 HITL 遗漏引用 → typecheck + 定向 grep。

## Open

**无。** 产品与 FE 边界已在 Grill 收口；实现以本文 + delta MUST 为准。
