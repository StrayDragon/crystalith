---
depends_on:
  - c105-research-revision-fork-run
branch: sdd/c106-research-parallel-branch-units
base_sha: 144f951397182d38cb004404690d6abeff0efef0
checkpointed: true
checkpoint_sha: 144f951397182d38cb004404690d6abeff0efef0
---

## Why

支路 work-unit 今日全串行，深档多节点时墙钟过长。需在守住「同 Run LLM 互斥」与图 SSOT 的前提下，允许调度层并行（检索 IO 重叠），降低等待。

## What Changes

1. **调度并行**：drain 可同时推进最多 N 个 live research 节点（N 默认 2–3，`config` 可调）。
2. **同 Run LLM 队列**：同一时刻每 Run 最多 1 个 LLM 调用（短综合 / tool loop 经 per-Run 队列串行）。
3. **写回加锁**：`persistGraph` / evidence 写回 per-Run 锁；各自 `graph_patch`。
4. **互斥保留**：节点 chat ↔ work-unit 仍互斥；cancel/prune 仍 abort 活动单元。
5. **测试**：并行 drain 不丢 merge；LLM 调用不重叠；取消仍干净。

## Locked decisions

- 调度并行（默认 N=2，config `parallelBranchUnits`）+ 同 Run LLM 串行队列 + 写回加锁
- `N=1` 保持串行等价；无新 HTTP 命令口
- BDD-off；独立分支；本波 C 最后一项

## Capabilities

- `deep-research-runtime` — 并行 drain / LLM 队列

## Impact

- `run-loop.ts` / `research-work-queue.ts` / config research 段
- 无新 HTTP 命令口（行为性能变更须进 spec）
- Follow-up：真多 LLM 并发（若未来需要）另议

## Seams

- `apps/server/src/features/research/run-loop.ts`
- `apps/server/src/shared/config.ts` + `config/app.yaml`
- `apps/server/tests/research/`
