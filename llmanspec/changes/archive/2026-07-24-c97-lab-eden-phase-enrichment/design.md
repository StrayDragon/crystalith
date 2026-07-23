# Design: c97-lab-eden-phase-enrichment

> **状态**：Apply 锁定 · 全程 **main**
>
> **Locked 2026-07-24**：I1=A · I2=A · I3=B · I4=A · I5=B
> **I5 覆盖 I1 第三档**：无 progress 时 **不**用节点 phase 众数，顶栏固定 `explore`（running）/ `decompose`（queued）。

## 相位推导（共用 `deriveEdenLabPhase`）

```text
inputs:
  run.status
  progressEvents[]（Eden GET/SSE 或 Fixture 合成 ledger）

priority (I1=A + I5=B):
  1. status ∈ awaiting_confirm | completed | failed | cancelled | null→idle
  2. else if progressEvents.length > 0 → 自新到旧映射最新可识别 kind（I4：graph_patched_summary→decompose）
  3. else status=queued → decompose；status=running → explore（I5=B 不猜）
```

## 进度 kind → LabPhase（running 细相位 · I2=A）

| progress kind（示意）                         | labPhase  |
| --------------------------------------------- | --------- |
| `graph_patched_summary` / `graph_seeded`      | decompose |
| `unit_started` / `node_phase`+retrieving      | explore   |
| `unit_finished` / `evidence_added` / skipped  | evaluate  |
| `report_*` / `revision_*` / `confirm_entered` | integrate |

## Fixture（I3=B）

- 内部 `playbackPhase` 仍驱动 `deriveLabState` 图快照 + timer
- 对外 `lab.phase` = `deriveEdenLabPhase(statusFromPlayback, progressEvents)`（与 Eden 同函数）
- Fixture ledger kind：integrate 用 `report_canonical_updated`，避免与 decompose 的 `graph_patched_summary` 冲突

## 非目标

- 不新增服务端 phase 枚举
- 不改 c94 work-unit / c96 confirm UI
