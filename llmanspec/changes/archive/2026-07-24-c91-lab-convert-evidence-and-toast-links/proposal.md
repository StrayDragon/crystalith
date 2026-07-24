---
depends_on: [c89-lab-revisions-and-convert, c87-lab-node-evidence-status-sync]
---

## Why

c89 落地了报告页与节点级 convert（`kind=report|node`），但节点抽屉「信息引用源」列表仍无 **per-evidence**（`kind=evidence`）转化入口；成功 toast 仅字符串弱提示「可在工作区打开」，**无可点击动作**打开工作区结果。本变更收口这两项 c89 residual，对齐 r409 MAY 弱链接与 r443 evidence artifact。

## What Changes

1. **Per-evidence convert**：当 LabNodeDrawer 已列出引用/证据时，每条证据 MUST 提供转为笔记/来源入口；Eden 调用既有 `convertResearchToNote` / `convertResearchToSource`，artifact `{ kind: 'evidence', evidenceId }`。
2. **Toast action 弱链接**：`apps/web/src/shared/toast.tsx` MUST 最小扩展可选 `action: { label, onClick }`；convert 成功 toast MUST 提供「打开工作区」类动作（`navigateToWorkspace` 或等价），失败 toast 无需 action。
3. **Fixture 隔离**：`VITE_LAB_FIXTURE=1` / `mode=fixture` 下 evidence convert MUST 保持 stub toast，MUST NOT 调用 Eden convert。
4. **质量**：Vitest 覆盖 toast action 渲染/点击 + 抽屉 evidence convert 入口（Eden 调 API、fixture stub）。

## Capabilities

- `deep-research-ui` — 证据级转化与 toast 弱链

## Impact

- 依赖 c89（convert API 客户端 + 节点 convert）与 c87（evidenceId → 引用列表）
- **不实现 c90**（扁平 notebook 别名删除）
- toast API 仅可选 action；既有 `toast.*(msg, duration?)` 调用保持兼容
- 无服务端合约变更（ResearchArtifactRef 已含 evidence）

## Seams

- `apps/web/src/shared/toast.tsx` — optional action
- `edenConvertActions` — success toast + navigateToWorkspace
- `LabNodeDrawer` — citation 行级 convert（kind=evidence）
- fixture stub path under `mode=fixture`
