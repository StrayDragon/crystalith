---
depends_on:
  [
    c91-lab-convert-evidence-and-toast-links,
    c96-lab-m1-confirm-surface,
    c94-research-branch-work-units,
  ]
---

## Why

Lab Eden 接线已分散落地（c82–c98），但 CI 仍可能仅依赖 `VITE_LAB_FIXTURE=1` 烟雾或 Vitest mock，无法证明**生产默认路径**端到端可用。本变更新增 `@p0` Playwright 门禁：在 **未设置 fixture** 下走 Compose → 图（含边/节点）→ M1 confirm → 报告 → convert，作为 c92–c99 波的合并验收（U10）。

## What Changes

1. **Eden e2e 路径**：`e2e/` MUST 含 `@p0` 用例，`VITE_LAB_FIXTURE` **unset**（或显式 0），真实 server + Eden Lab。
2. **步骤覆盖**：Compose 创建 → 等待图含 nodes/edges → 触发并处理 M1 confirm（budget 或 expand_branch 之一，测试环境可 stub 内核加速）→ 打开报告页 → convert（note 或 source）→ toast 成功。
3. **testid**：沿用 `e2e/fixtures/testids.ts` 既有 `research-lab-*`；不足时最小增补。
4. **非 fixture parity**：仅 fixture 回放通过的 smoke **MUST NOT** 替代本门禁作为生产对拍证明。
5. **CI**：纳入 `just e2e` / `@p0` 筛选；文档注明环境前提（mock LLM 或测试 server 配置）。

## Locked decisions

- **BDD-off**；Apply：**全程 main**（本 change archive+commit 后才开下一条）
- Fixture **保留至本变更门禁绿**；之后另议删除（L5=D）
- 产品默认 Eden；本门禁验证 Eden 非 fixture（L5=A）
- **L1=A+B** · **L2=A** · **L3=C** · **L4=A+B** · **L5=A+B+D** · **L6** 截图+run JSON
- depends_on c96（M1 UI）、c94（branch 图）、c91（convert toast）
- **本波 MUST NOT 再延后**

## Capabilities

- `deep-research-ui` — Eden 生产路径 e2e 门禁

## Impact

- `e2e/tests/` 新或扩展现有 spec；`just e2e` 门禁
- 可能需要 test server 种子或 mock provider（与既有 e2e harness 对齐）
- 不引入新 product API

## Seams

- `e2e/tests/` — Playwright `@p0` spec
- `just e2e` / `bun run e2e` — 筛选 `@p0`
- `e2e/fixtures/testids.ts` — Lab 选择器
- dev server env：`VITE_LAB_FIXTURE` 未设
