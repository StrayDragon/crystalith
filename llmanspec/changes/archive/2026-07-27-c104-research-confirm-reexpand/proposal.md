---
depends_on: []
branch: sdd/c104-research-confirm-reexpand
base_sha: 20ab202381fa97c44eb77980e151d6ca8104c2b3
checkpointed: true
checkpoint_sha: 20ab202381fa97c44eb77980e151d6ca8104c2b3
---

## Why

c93/c94 在 seed 后只做**一次** topic decompose + drain。预算未尽或用户想加深时，只能靠既有 `expand_branch` 单点扩支，缺少「显式再扩展 / 局部再拆」的 confirm 门面。需在**不自动二次 decompose** 的前提下，补齐用户触发的再扩展能力。

## What Changes

1. **仅人工 / M1 门触发**：内核 MUST NOT 在无 confirm / 显式用户动作时自动再 decompose。
2. **再扩展命令面**：对齐/扩展现有 `expand_branch` 或新增等价 confirm 动作（如 `request_expand`，名以 design 为准），允许用户批准后追加 research 节点（仍受 `maxNodes`/`maxSearches`）。
3. **局部再拆（可选同 change）**：对选定支路/主题片段结构化再规划 → 经内核写图 + `graph_patch`；失败 MUST NOT 伪造拓扑。
4. **进度**：再扩展 MUST 写入 progress ledger；FE Lab 仅经 confirm 命令口，无 timer 权威。

## Locked decisions

- 总序 C1 → C2 → C3；本 change = **C1**
- BDD-off；独立 `sdd/<id>` 分支
- 无自动二次 decompose

## Capabilities

- `deep-research-runtime` — 再扩展 / 再拆 confirm 门
- `deep-research-ui` — Lab confirm / 显式动作面（最小）

## Impact

- server `run-loop` / `confirm` / decompose planner 复用
- Lab M1 / 节点动作最小接线
- Follow-up：C2 revision→新 Run；C3 并行

## Seams

- `apps/server/src/features/research/{run-loop,commands,decompose,report}.ts`
- `packages/shared/src/schemas/research.ts` — confirm body / kind
- Lab confirm UI（若缺动作）
- `apps/server/tests/research/`
