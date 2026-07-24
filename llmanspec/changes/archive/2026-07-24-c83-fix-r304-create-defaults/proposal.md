---
depends_on: [c81-align-lab-research-api]
---

## Why

c81 已把 create 省略字段默认改为 **外网优先**（`useNotebookSources=false`，`allowWeb=true`），但 live `r304` 仍写「默认皆为 true」且「省略不得静默改为仅外网」——与实现和 Lab Compose **矛盾**。本变更把合约对齐已发布行为，并顺手修 AsyncAPI / 注释漂移。

## What Changes

1. **modify `r304`**：省略时默认 `useNotebookSources=false` + `allowWeb=true`；显式 `useNotebookSources=true` 仍须非空 `sourceIds`；双关 false 仍拒绝。
2. **modify `r311`（可选对齐）**：stream 事件列表补上已实现的 `progress`。
3. **文档**：`deep-research-runtime` purpose；AsyncAPI `researchStream` 补 `progress`；research router 去掉过时 Desk 注释。
4. **Non-Goals**：不改 handler 逻辑（已与目标一致）；不删 research 路由；不做 c82 Eden 接线。

## Capabilities

- `deep-research-runtime` — 修正 create 默认与 stream 文档

## Impact

- depends_on `c81-align-lab-research-api`
- Spec 与 API 一致；便于 c82 接线时无合约漂移
