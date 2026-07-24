---
depends_on: [c91-lab-convert-evidence-and-toast-links]
---

## Why

c83 与 r305/r401 已在服务端与 Desk 合约锁定浅/中/深三档深度（默认中），但 Lab Compose 仍缺深度控件，Eden 创建路径也未显式传 `depth`，导致用户无法在 Lab 主表面选择研究规模，且 Run 预算可能与 Desk 行为不一致。

## What Changes

1. **LabComposePanel 深度档位**：暴露浅/中/深（默认中），与 `ResearchDepthSchema` / r305 映射一致。
2. **Compose draft + gate**：`LabComposeDraft` 增加 `depth`；校验与禁用逻辑不变（仍走 topic/通道/sourceIds gate）。
3. **Eden 创建**：`createResearchRun` body MUST 携带所选 `depth`；省略时服务端仍默认中（r305），但 Eden 路径 MUST 显式发送用户选择。
4. **对齐 r401**：Compose 深度 UX 与 Desk 创建表单语义一致（三档、默认中）。
5. **质量**：Vitest 覆盖 depth 默认值、切换、以及 Eden submit 请求体含 `depth`。

## Capabilities

- `deep-research-ui` — r447 Lab Compose 深度档位与创建传参

## Impact

- depends_on `c91-lab-convert-evidence-and-toast-links`（Lab Eden 接线末档）
- **BDD-off**；归档时 TOON delta 合并进 `deep-research-ui`
- **Apply**：**全程 main**（本 change archive+commit 后才开下一条）
- **Fixture**：`xlsx-lib` 保留至 c100；Eden 为产品默认；fixture Compose MAY 忽略 depth 或仅展示（不阻塞本变更 Eden 路径）
- **M1 / 进度**：本变更不触碰 M1 确认与 progress ledger（c93–c95）
- **MUST NOT defer further**：本变更 MUST 在 c93 内核拆解前完成 Compose→create depth 传参

## Seams

- `apps/web/src/features/research-lab/LabComposePanel.tsx` — 深度 UI
- `apps/web/src/features/research-lab/labComposeGate.ts` — draft 形与默认值
- `apps/web/src/features/research-lab/useEdenLabController.ts` — compose state + submit
- `apps/web/src/features/research-lab/edenResearchApi.ts` — `createResearchRun` body
- `packages/shared/src/schemas/research.ts` — `ResearchCreateBody.depth`（已存在，仅接线）
