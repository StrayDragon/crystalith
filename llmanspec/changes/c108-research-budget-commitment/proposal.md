---
depends_on:
  - c107-research-web-page-evidence
status: full
branch: sdd/c108-research-budget-commitment
base_sha: 5851bbd259781abcf768356f1c19c6831f61b6e5
checkpointed: false
---

## Why

现行 L1 预算过紧，且 M1 `budget` 在「仍有剩余 / 逼近 max-1」时打断，`continue` 又不抬天花板——长等待后断崖失败。
用户开跑即有心理用量承诺：档内应尽量跑完，真触顶再诚实加购；检索深度由 agent + 每节点软上限共同决定。

**depends_on c107**：抬搜索预算前先具备读正文能力。

## What Changes

1. 开跑承诺：去掉波次剩余打断与 max-1 逼近打断。
2. L1：**搜 20/50/100 · 节点 24/60/120**；默认仍 medium。
3. 触顶 confirm：`continue`=公式加购；`finish_report`=部分完成诚实报告。
4. `K = clamp(ceil(maxSearches×addOnRatio), minK, maxK)`（默认 0.25 / 5 / 50）。
5. 主动加购：Lab 常驻按钮 + agent propose；同一命令口。
6. 搜索软上限：`ceil(remainingSearches / remainingLiveResearchNodes)`。
7. continue **不**抬 maxNodes（扩图走 reexpand）。
8. 读页预算仍归 c107（独立 pages；本变更只管搜索）。

## Locked decisions

Explore 1–10 + OQ 全锁；seams 方案 1。详见 `design.md`。

## Non-Goals

- 读页实现（c107）；token/费用计费 SSOT；逐步计划审批 UI。

## Capabilities

- `deep-research-runtime` — r305/r306/r327 修订；r341–r344
- `deep-research-ui` — r449 修订；r461–r462

## Impact / Seams

- `RESEARCH_DEPTH_BUDGETS` / run-loop / commands / config / Lab UI / tests
