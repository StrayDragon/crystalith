---
depends_on: []
branch: sdd/c66-research-graph-keyboard-access
base_sha: 141acd4a999519cc8603eaf964c0aa1115b607cd
base_branch: main
---

# Lab 研究图键盘可达性：节点 inspector 与边操作可键盘触达

> 2026-09 P3 跟进台账（_HANDOFF.md）第一项。r406 只合约了「单击节点 MUST 打开轻量 inspector」，键盘路径为零合约——xyflow 默认给节点 tabIndex（可聚焦、Enter 仅切换选中），但打开 inspector 的唯一入口 `onNodeClick` 只响应鼠标；边分叉/剪枝按钮 hover 才可见。键盘用户在 Lab 是残缺的，需要新增 MUST 条款，故走 SDD。

## Why

**1. 键盘用户打不开节点 inspector。**

`apps/web/src/features/research-lab/LabGraph.tsx:594`：`onNodeClick` 是打开 LabNodeDrawer 的唯一入口，xyflow v12 只在鼠标点击时派发该回调；键盘 Tab 聚焦节点后按 Enter 仅触发库内选中切换，永不调用 `onSelectNode`。r406 的 inspector 合约（含剪枝/fork/convert 与节点对话入口）对纯键盘用户整体不可达。

**2. 边上的 fork/prune 完全不可键盘触达。**

`LabGraph.tsx:259-273`：分叉/剪枝按钮（`LabGraph.tsx:279/292`）包在 `EdgeLabelRenderer` 内，可见性由 `onMouseEnter/onMouseLeave` hover 态控制；交互热区是一段透明 28px 宽的 `<path>`（`cursor:pointer`）。键盘既无法感知边，也无法触达按钮——r406 的剪枝/fork 能力在边上只有鼠标路径。

对照：画布缩放（`Controls` 组件是真按钮）与小地图（`ariaLabel`）已可达，缺口集中在节点打开与边操作两点。

## What Changes

- **spec 增量（deep-research-ui，紧邻 r406 新增一条 req）**：running/awaiting_confirm 态下，键盘用户 MUST 能聚焦研究图节点并以键盘动作（Enter/Space 或等价）打开节点 inspector；边上可达的 fork/prune 操作 MUST 键盘可达（MUST NOT 仅 hover 可见/可触发）；r406 的只读态禁令（completed/failed/cancelled MUST NOT prune/fork）对键盘路径同样适用。鼠标行为不变。
- **web 实现（LabGraph.tsx，单点）**：`LabFlowNode` 内层加 `onKeyDown`（Enter/Space → 经 node data 调 `onSelectNode`）；边 fork/prune 按钮常驻 DOM，可见性改 CSS（`group-hover` / `group-focus-within`）控制，按钮本就是 `<button>` 保持 Tab 序即边序。
- **锁测试**：LabGraph 键盘交互测试（Enter 打开抽屉；Tab 可达边操作按钮；只读态 Enter 不触发）。

## 证据快照（2026-09-16）

| 证据                                           | 位置                                                      |
| ---------------------------------------------- | --------------------------------------------------------- |
| onNodeClick 是打开 inspector 唯一入口          | `apps/web/src/features/research-lab/LabGraph.tsx:594`     |
| 边按钮 hover 门控（onMouseEnter/onMouseLeave） | `apps/web/src/features/research-lab/LabGraph.tsx:259-273` |
| fork/prune 按钮本体                            | `apps/web/src/features/research-lab/LabGraph.tsx:279/292` |
| 既有条款（本变更在其上补键盘路径）             | `deep-research-ui.feature` r406                           |

### 证据刷新方法（apply 开头再跑一次）

```bash
grep -n "onNodeClick\|onMouseEnter" apps/web/src/features/research-lab/LabGraph.tsx
grep -n "r406" llmanspec/specs/deep-research-ui/deep-research-ui.feature
```

若节点/边交互入口已变更 → 按新入口重写任务；若 r406 已含键盘条款 → 关闭对应任务。

## 非目标

- 不做全图 ARIA 审计与屏读播报（graph_patch 增量的无障碍通告超出本波）。
- 不改鼠标行为、不改 inspector/抽屉内容（c63 已对齐）。
- 不动 xyflow 库配置语义（`nodesFocusable` 等维持默认；不新增键盘快捷键体系）。

## 追记（2026-09-17，subagent review 后小修）

- **上节第 3 条非目标被 apply 推翻**：实现设了 `nodesFocusable={false}`（LabGraph.tsx），让焦点
  落在内层节点卡而非 xyflow wrapper，避免双 tab stop；后续又补 `edgesFocusable={false}` 清掉
  边的空 tab stop。两者均为纯 a11y 增益，无鼠标行为变化。
- **只读门控补全（r406/r15）**：review 发现 `canFork/canPrune` 此前仅挡节点级 pruned，Run 级
  终态（completed/failed/cancelled）在图接缝无门控——这是 r406 时代的既有缺口，键盘奇偶性如实
  继承。现已由 `layoutWithElk opts.readOnly` + ResearchLabPage 传 `RESEARCH_TERMINAL_STATUSES`
  关闭，终态下边按钮不渲染、节点仍可打开只读抽屉；锁测试补终态用例。
- 工件措辞勘误：design §2 的「useMemo 里接线」实为 ELK effect + ref 转发；tasks 的「group-hover」
  实为 hovered 态 + `group-focus-within` CSS（无 group-hover）。机制描述以本追记为准。
