---
depends_on: [c82-wire-lab-eden, c94-research-branch-work-units]
---

## Why

服务端已有 `GET …/research/:rid/progress` 账本与 SSE `progress` 事件，但 Eden Lab 仅将 progress 消息追加到 `activityLog`（log-only），顶栏 `LabProgressBar` 仍用 fixture 式 `LabPhase` 百分比映射。用户无法在 Lab 主表面查看结构化进度时间线与指标，且 timer/phase 进度条易被误认为 Run 权威。

## What Changes

1. **Progress 面板**：Lab MUST 展示专用 timeline/metrics 面板（可复用/扩展 `LabProgressBar` 或新组件），数据源为 `listProgress` HTTP 与/或 SSE `progress` 事件聚合。
2. **非 log-only**：进度详情 MUST NOT 仅存在于可折叠 console log；顶栏或侧栏 MUST 可见结构化事件（kind、headline、时间、关联 nodeId）。
3. **Eden 默认**：生产路径以服务端 ledger 为权威；加载 Run 时 gap-fill `GET progress?afterSeq=`。
4. **禁止假进度**：MUST NOT 用 `PHASE_PROGRESS` 定时器或 fixture phase 百分比作为 Eden Run 的权威进度；fixture 模式 MAY 保留演示映射。
5. **质量**：Vitest 覆盖 progress 列表渲染与 SSE 追加；testid `research-lab-progress` 保留或扩展。

## Capabilities

- `deep-research-ui` — r448 Lab progress ledger 面板

## Impact

- depends_on `c82-wire-lab-eden`（Eden 流已接线）、`c94-research-branch-work-units`（单元事件有意义）
- **BDD-off**；不新增 runtime 合约（复用既有 progress API/SSE）
- **Apply**：**全程 main**
- **Fixture xlsx-lib** 保留至 c100；Eden 为产品默认
- **M1 confirms 保留**；awaiting_confirm 时进度展示 MUST 与 r437 一致（不矛盾 playing 横幅）
- **进度权威**：真实 ledger，非 timer
- **MUST NOT defer further**：c93/c94 后端事件无 UI 落点则用户不可见多支路进展

## Seams

- `apps/web/src/features/research-lab/useEdenLabController.ts` — progress state、SSE/HTTP 聚合
- `apps/web/src/features/research-lab/edenResearchApi.ts` — `listProgress` client（若缺则加）
- 新或扩展面板组件（如 `LabProgressLedgerPanel` / `LabProgressBar`）
- `apps/web/src/features/research-lab/ResearchLabPage.tsx` — 布局挂载
- `apps/web/src/shared/testids.ts` — `researchLabProgress`
