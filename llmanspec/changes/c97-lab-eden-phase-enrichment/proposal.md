---
depends_on: [c94-research-branch-work-units, c95-lab-progress-ledger-panel]
---

## Why

Fixture 路径经 `deriveLabState` + timer 回放展示 `explore` / `evaluate` / `integrate` 等细粒度相位；Eden 默认路径顶栏与 ledger 仍多停留在 `queued` / `running` / `completed` 粗粒度，与 xlsx-lib 对拍观感脱节。c95 落地 progress ledger 面板后，本变更用 **真实 progress 事件 + 节点 phase / 图状态** 富化 Eden 相位标签，禁止 timer 作为权威态（对齐 U8 与 r415）。

## What Changes

1. **相位映射**：Eden Lab 顶栏 progress / ledger MUST 将 `GET …/progress` 与 SSE progress 事件、Run `status`、节点 `phase` 聚合为与 fixture 可比的相位（至少含 evaluate / integrate 等等价标签）。
2. **图状态参与**：当多数 research 节点处于 evaluate/integrate 类 phase 时，全局相位 MUST 反映（经 `researchGraphAdapter` 或专用 `deriveEdenLabPhase`）。
3. **非 timer 权威**：Eden 路径 MUST NOT 以 `advanceLabPlayback` / fixture timer 驱动相位 SSOT；fixture 模式 MAY 保留既有回放。
4. **与 c95 衔接**：ledger 面板消费同一相位推导，避免顶栏与 ledger 矛盾。
5. **质量**：Vitest 覆盖 progress 事件 → 相位映射表；手测 Eden Run 推进时相位递进。

## Locked decisions

- **BDD-off**；Apply：**全程 main**（本 change archive+commit 后才开下一条）
- Fixture 保留至 c100；产品默认 Eden
- **相位富化**来自真实 progress/graph — **禁止 timer SSOT**
- M1 确认面在 c96；本变更不重复 confirm UI
- **本波 MUST NOT 再延后**

## Capabilities

- `deep-research-ui` — Eden 相位富化

## Impact

- depends_on c94（branch work-units 产生可映射的 node.phase）与 c95（ledger 展示面）
- 无新 HTTP 合约；消费既有 progress SSE / GET progress
- 与 c96 并行可能；相位推导与 M1 横幅条件需一致（r437）

## Seams

- `researchGraphAdapter` — 节点 phase → Lab 展示
- `deriveLabState` 旁新建或扩展 Eden 相位推导（`deriveEdenLabPhase`）
- `useEdenLabController` — progress 事件合并
- `LabProgressBar` / progress ledger 面板 — 富化标签源
