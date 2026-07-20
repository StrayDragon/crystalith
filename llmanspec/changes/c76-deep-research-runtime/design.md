## Context

- 产品：`docs/product/deep-research-prd.md` v0.2.3（Grill B…M1 收口）。
- 现状：`apps/server/src/features/research/router.ts` 仅 501 stub；c75 顶栏 E1 + 直接搜索已归档。
- 约束：AI SDK v7 only；禁止 LangGraph/Mastra；`webSearch` 单实现。

## Goals / Non-Goals

**Goals（本 change）**

- 后端 ResearchRun full 路径：CRUD 子集、执行推进、checkpoint/graph、报告+citation map、M1 确认、转化 API。
- Shared Zod + OpenAPI/Eden 对齐。
- 单测覆盖 create / confirm / convert / webSearch 共用。

**Non-Goals**

- FE 深研台 / xyflow / Report 交互（占位 tasks；另 change + grill 1/2）。
- 恢复旧 HITL 全套（approve plan / modify / skip step 全家桶）。
- 整本 notebook 语义搜索（P2+）。
- 完成时自动写笔记。

## Architecture

```text
POST /v2/notebooks/:nid/research          → create Run (H1′ D1 toggles + desk sourceIds + L1)
GET  /v2/notebooks/:nid/research          → listRuns
GET  /v2/notebooks/:nid/research/:rid     → getRun (graph + report summary)
POST .../research/:rid/confirm            → M1 continue | finish-report | approve-branch | skip-branch
POST .../research/:rid/convert-to-note    → PARAGRAPH + K1 footnotes
POST .../research/:rid/convert-to-source  → ingest + embed
GET  .../research/:rid/stream             → status / graph_patch / confirm / report_ready / log / error（R3b）
```

执行器：主控编排原子 tools；每步或每 N 节点写 checkpoint；状态机：`queued | running | awaiting_confirm | completed | failed | cancelled`（R2a）。

**Report SSOT（K1）**：结构化 sections + 内联 citeId → 全局 `Citation[]` map；转笔记时 serializer → GFM `[^n]`。

## Decisions

| 主题       | 选择                                                               | 依据            |
| ---------- | ------------------------------------------------------------------ | --------------- |
| SSOT       | ResearchRun                                                        | Grill B         |
| 笔记       | 显式 convert → PARAGRAPH                                           | B1 / I1         |
| 引用导出   | GFM footnotes，无 MD 双向解析                                      | K1              |
| 来源/外网  | 显式双开关 + 台内重选；默认皆开；空选禁用开始；不绑 workspace 勾选 | H1′ D1          |
| 深度       | L1 三档                                                            | Grill L1        |
| 确认       | M1 两类                                                            | Grill M1        |
| Agent 框架 | AI SDK tools + 自研 loop                                           | NG4 / AGENTS.md |
| FE         | 本 change 占位                                                     | 用户确认范围    |

## Risks

- 长跑与取消：需 abort signal + 预算计数准确，否则 M1 误触。
- 转化后未 embed → 对话检不到（验收必测）。
- 路径/字段命名勿复活旧 session HITL 语义，避免客户端误用。

## Open (defer to grill 1/2 docs)

- graph patch 精确事件 schema、节点类型枚举。
- Run 详情 Layer 与 E1 叠放的 FE 状态机（F1/G1 已定产品，实现细节待 ui-proto）。
